const { setGlobalOptions } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const { buildMatchId } = require('./match-id.js');

setGlobalOptions({ maxInstances: 1, region: 'us-central1' });

initializeApp();
const db = getFirestore();

const GITHUB_OWNER = 'upbound-web';
const GITHUB_REPO = 'worldcup-live.json';
const GITHUB_FILE_PATH = '2026/worldcup.json';
const GITHUB_BRANCH = 'master';

const RAW_MATCHES_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;
const COMMITS_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?path=${GITHUB_FILE_PATH}&per_page=1`;

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

async function fetchRawTournament() {
  const res = await fetch(RAW_MATCHES_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Raw JSON fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
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
    const firstRun = isFirstRun(existingMatchIds);

    if (meta && meta.lastCommitSha === remoteSha && !firstRun) {
      console.log('syncTournament: no commit changes and cache populated, skipping');
      return;
    }

    let fresh;
    try {
      fresh = await fetchRawTournament();
    } catch (err) {
      console.error('fetchRawTournament failed', err);
      return;
    }

    const tournament = enrichMatchesWithIds(fresh);
    const contentHash = hashContent(fresh);
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
      { merge: true }
    );

    await batch.commit();

    if (firstRun) {
      console.log(`syncTournament: first run, wrote ${tournament.matches.length} match docs`);
    } else {
      console.log(`syncTournament: wrote ${tournament.matches.length} match docs`);
    }
  }
);
