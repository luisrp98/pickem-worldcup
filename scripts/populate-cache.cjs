const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing FIREBASE_* env vars in .env');
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore();

const GITHUB_OWNER = 'upbound-web';
const GITHUB_REPO = 'worldcup-live.json';
const GITHUB_FILE_PATH = '2026/worldcup.json';
const GITHUB_BRANCH = 'master';

const RAW_MATCHES_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}`;

const CACHE_COLLECTION = 'cache';
const TOURNAMENT_META_DOC_ID = '_tournament';
const LEGACY_WRAPPER_DOC_ID = 'tournament';
const META_COLLECTION = 'meta';
const META_DOC_ID = 'sync';

function slugifyTeam(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildMatchId(match) {
  return `${match.date}__${slugifyTeam(match.team1)}-vs-${slugifyTeam(match.team2)}`;
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

async function main() {
  console.log('Fetching from GitHub...');
  const res = await fetch(RAW_MATCHES_URL, { cache: 'no-store' });
  if (!res.ok) {
    console.error('Fetch failed:', res.status, res.statusText);
    process.exit(1);
  }
  const fresh = await res.json();
  console.log('Fetched. Matches:', fresh.matches.length);

  const tournament = enrichMatchesWithIds(fresh);
  const contentHash = createHash('sha256').update(JSON.stringify(fresh)).digest('hex');
  const now = new Date().toISOString();

  console.log('Reading existing cache...');
  const cacheSnap = await db.collection(CACHE_COLLECTION).get();
  const existingMatchIds = [];
  let hasLegacy = false;
  for (const doc of cacheSnap.docs) {
    if (doc.id === TOURNAMENT_META_DOC_ID) continue;
    if (doc.id === LEGACY_WRAPPER_DOC_ID) {
      hasLegacy = true;
      continue;
    }
    if (!doc.id.includes('__')) continue;
    existingMatchIds.push(doc.id);
  }

  const newIds = new Set(tournament.matches.map((m) => m.id));
  const batch = db.batch();

  if (hasLegacy) {
    console.log('Deleting legacy wrapper doc...');
    batch.delete(db.collection(CACHE_COLLECTION).doc(LEGACY_WRAPPER_DOC_ID));
  }

  console.log('Writing _tournament meta...');
  batch.set(db.collection(CACHE_COLLECTION).doc(TOURNAMENT_META_DOC_ID), {
    name: tournament.name,
    updatedAt: now,
  });

  console.log(`Writing ${tournament.matches.length} match docs...`);
  for (const match of tournament.matches) {
    const ref = db.collection(CACHE_COLLECTION).doc(match.id);
    const { id, ...rest } = match;
    batch.set(ref, { id, ...rest, _updatedAt: now });
  }

  let deleted = 0;
  for (const oldId of existingMatchIds) {
    if (!newIds.has(oldId)) {
      batch.delete(db.collection(CACHE_COLLECTION).doc(oldId));
      deleted++;
    }
  }
  if (deleted > 0) console.log(`Deleting ${deleted} stale match docs...`);

  console.log('Writing meta/sync...');
  batch.set(
    db.collection(META_COLLECTION).doc(META_DOC_ID),
    {
      lastCommitSha: 'local-script',
      contentHash,
      lastSyncAt: now,
    },
    { merge: true }
  );

  await batch.commit();
  console.log('Done.');
  console.log('---');
  console.log('Tournament:', tournament.name);
  console.log('Match docs written:', tournament.matches.length);
  console.log('Legacy deleted:', hasLegacy);
  console.log('Stale deleted:', deleted);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
