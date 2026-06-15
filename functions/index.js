const { setGlobalOptions } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createHash } = require('node:crypto');
const { buildMatchId } = require('./match-id.js');
const { calculateMatchPoints, SCORING_VERSION } = require('./scoring.js');

setGlobalOptions({ maxInstances: 1, region: 'us-central1' });

initializeApp();
const db = getFirestore();

const GITHUB_OWNER = 'upbound-web';
const GITHUB_REPO = 'worldcup-live.json';
const GITHUB_FILE_PATH = '2026/worldcup.json';
const GITHUB_BRANCH = 'master';

const COMMITS_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=${GITHUB_FILE_PATH}&per_page=1`;
const API_CONTENTS_URL = (sha) =>
  `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${sha}`;

const CACHE_COLLECTION = 'cache';
const TOURNAMENT_META_DOC_ID = '_tournament';
const LEGACY_WRAPPER_DOC_ID = 'tournament';
const META_COLLECTION = 'meta';
const META_DOC_ID = 'sync';

const githubToken = defineSecret('GITHUB_TOKEN');

function getGithubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchLastCommitSha(token) {
  const res = await fetch(COMMITS_URL, { headers: getGithubHeaders(token) });
  if (!res.ok) {
    throw new Error(`GitHub commits API failed: ${res.status} ${res.statusText}`);
  }
  const commits = await res.json();
  const first = commits[0];
  if (!first?.sha) {
    throw new Error('GitHub commits API returned no commits');
  }
  return first.sha;
}

async function fetchTournamentAtSha(sha, token) {
  const res = await fetch(API_CONTENTS_URL(sha), {
    cache: 'no-store',
    headers: getGithubHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub contents API failed: ${res.status} ${res.statusText}`);
  }
  const file = await res.json();
  const cleaned = (file.content ?? '').replace(/\n/g, '');
  return JSON.parse(Buffer.from(cleaned, 'base64').toString('utf8'));
}

function hashContent(json) {
  return createHash('sha256').update(JSON.stringify(json)).digest('hex');
}

function enrichMatchesWithIds(tournament) {
  if (!tournament || !Array.isArray(tournament.matches)) return tournament;
  const enriched = { ...tournament };
  enriched.matches = tournament.matches.map((m) => {
    if (m.id && typeof m.id === 'string') return m;
    return { ...m, id: buildMatchId(m) };
  });
  return enriched;
}

async function readMeta() {
  const snap = await db.collection(META_COLLECTION).doc(META_DOC_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (!data.lastCommitSha || !data.contentHash) return null;
  return {
    lastCommitSha: data.lastCommitSha,
    contentHash: data.contentHash,
    lastSyncAt: data.lastSyncAt ?? '',
  };
}

async function readExistingMatchIds() {
  const snap = await db.collection(CACHE_COLLECTION).get();
  const ids = [];
  for (const doc of snap.docs) {
    if (doc.id === TOURNAMENT_META_DOC_ID) continue;
    if (doc.id === LEGACY_WRAPPER_DOC_ID) continue;
    if (!doc.id.includes('__')) continue;
    ids.push(doc.id);
  }
  return ids;
}

async function loadExistingScores() {
  const snap = await db.collection(CACHE_COLLECTION).get();
  const map = new Map();
  for (const doc of snap.docs) {
    if (doc.id === TOURNAMENT_META_DOC_ID) continue;
    if (doc.id === LEGACY_WRAPPER_DOC_ID) continue;
    if (!doc.id.includes('__')) continue;
    const data = doc.data();
    const ft = data?.score?.ft;
    if (Array.isArray(ft) && ft.length === 2 && typeof ft[0] === 'number' && typeof ft[1] === 'number') {
      map.set(doc.id, [ft[0], ft[1]]);
    } else {
      map.set(doc.id, null);
    }
  }
  return map;
}

function diffScores(existing, freshMatches) {
  const changed = [];
  for (const m of freshMatches) {
    if (!m?.id) continue;
    const oldFt = existing.has(m.id) ? existing.get(m.id) : null;
    const rawFt = m.score?.ft;
    const newFt =
      Array.isArray(rawFt) && rawFt.length === 2 && typeof rawFt[0] === 'number' && typeof rawFt[1] === 'number'
        ? [rawFt[0], rawFt[1]]
        : null;

    if (newFt === null && oldFt === null) continue;
    if (newFt === null || oldFt === null) {
      changed.push(m.id);
      continue;
    }
    if (newFt[0] !== oldFt[0] || newFt[1] !== oldFt[1]) {
      changed.push(m.id);
    }
  }
  return changed;
}

async function listAllUserUids() {
  const auth = getAuth();
  const uids = [];
  let nextPageToken = undefined;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    for (const u of result.users) uids.push(u.uid);
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return uids;
}

async function scoreMatches(changedIds, freshMatches) {
  if (changedIds.length === 0) return { scored: 0, matches: 0 };

  const matchesById = new Map();
  for (const m of freshMatches) {
    if (m?.id) matchesById.set(m.id, m);
  }

  let uids;
  try {
    uids = await listAllUserUids();
  } catch (err) {
    console.error('scoreMatches: listAllUserUids failed', err);
    return { scored: 0, matches: 0, error: 'list-users-failed' };
  }
  if (uids.length === 0) return { scored: 0, matches: 0 };

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  let updates = 0;

  for (const matchId of changedIds) {
    const match = matchesById.get(matchId);
    if (!match) continue;
    if (!Array.isArray(match.score?.ft)) continue;

    const refs = uids.map((uid) => db.collection('users').doc(uid).collection('predictions').doc(matchId));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data();
      if (typeof data.score1 !== 'number' || typeof data.score2 !== 'number') continue;
      const points = calculateMatchPoints(match, { score1: data.score1, score2: data.score2 });
      if (points === null) continue;
      batch.set(
        snap.ref,
        {
          points: points.points,
          resultado: points.resultado,
          marcador: points.marcador,
          scoredAt: nowIso,
          scoringVersion: SCORING_VERSION,
        },
        { merge: true },
      );
      updates++;
    }
  }

  if (updates > 0) {
    await batch.commit();
    console.log(`scoreMatches: updated ${updates} prediction docs across ${changedIds.length} matches`);
  } else {
    console.log(`scoreMatches: no predictions to update for ${changedIds.length} changed matches`);
  }

  return { scored: updates, matches: changedIds.length };
}

function isFirstRun(existingMatchIds) {
  return existingMatchIds.length === 0;
}

async function hasLegacyWrapperDoc() {
  const snap = await db.collection(CACHE_COLLECTION).doc(LEGACY_WRAPPER_DOC_ID).get();
  return snap.exists;
}

exports.syncTournament = onSchedule(
  {
    schedule: '0 0,9-23 * * *',
    timeZone: 'America/Hermosillo',
    secrets: [githubToken],
  },
  async () => {
    const token = githubToken.value();

    let remoteSha;
    try {
      remoteSha = await fetchLastCommitSha(token);
    } catch (err) {
      console.error('fetchLastCommitSha failed', err);
      return;
    }

    const meta = await readMeta();
    const existingMatchIds = await readExistingMatchIds();
    const existingScores = await loadExistingScores();
    const firstRun = isFirstRun(existingMatchIds);

    let fresh;
    try {
      fresh = await fetchTournamentAtSha(remoteSha, token);
    } catch (err) {
      console.error('fetchTournamentAtSha failed', err);
      return;
    }

    const contentHash = hashContent(fresh);

    if (meta && meta.lastCommitSha === remoteSha && meta.contentHash === contentHash && !firstRun) {
      console.log('syncTournament: no commit changes and cache content matches, skipping');
      return;
    }

    const tournament = enrichMatchesWithIds(fresh);
    const now = new Date().toISOString();

    const newIds = new Set(tournament.matches.map((m) => m.id));
    const batch = db.batch();

    if (await hasLegacyWrapperDoc()) {
      batch.delete(db.collection(CACHE_COLLECTION).doc(LEGACY_WRAPPER_DOC_ID));
      console.log('syncTournament: deleting legacy wrapper doc');
    }

    batch.set(db.collection(CACHE_COLLECTION).doc(TOURNAMENT_META_DOC_ID), {
      name: tournament.name,
      updatedAt: now,
    });

    for (const match of tournament.matches) {
      const ref = db.collection(CACHE_COLLECTION).doc(match.id);
      const { id, ...rest } = match;
      batch.set(ref, { id, ...rest, _updatedAt: now });
    }

    for (const oldId of existingMatchIds) {
      if (!newIds.has(oldId)) {
        batch.delete(db.collection(CACHE_COLLECTION).doc(oldId));
      }
    }

    batch.set(
      db.collection(META_COLLECTION).doc(META_DOC_ID),
      {
        lastCommitSha: remoteSha,
        contentHash,
        lastSyncAt: now,
      },
      { merge: true },
    );

    await batch.commit();

    if (firstRun) {
      console.log(`syncTournament: first run, wrote ${tournament.matches.length} match docs`);
    } else {
      console.log(`syncTournament: wrote ${tournament.matches.length} match docs`);
    }

    const changedIds = diffScores(existingScores, tournament.matches);
    if (changedIds.length > 0) {
      console.log(`syncTournament: ${changedIds.length} matches changed, scoring predictions...`);
      await scoreMatches(changedIds, tournament.matches);
    }
  },
);
