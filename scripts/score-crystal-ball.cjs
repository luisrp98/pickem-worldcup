const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

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
const auth = getAuth();

const SCORING_VERSION = 1;

async function listAllUserUids() {
  const uids = [];
  let nextPageToken = undefined;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    for (const u of result.users) uids.push(u.uid);
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return uids;
}

async function loadAnswers() {
  const snap = await db.collection('crystalBall').doc('answers').get();
  if (!snap.exists) {
    throw new Error('crystalBall/answers not found. Run scripts/seed-crystal-ball-answers.cjs first.');
  }
  const data = snap.data();
  if (!data || !Array.isArray(data.entries)) {
    throw new Error('crystalBall/answers has no entries array.');
  }
  const byId = new Map();
  for (const e of data.entries) {
    if (!e || typeof e.id !== 'string') continue;
    if (!byId.has(e.id)) byId.set(e.id, []);
    byId.get(e.id).push(e);
  }
  return byId;
}

function findEntryForValue(entries, value) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (entries.length === 1) {
    return entries[0].ans === value ? entries[0] : null;
  }
  return entries.find((e) => e.ans === value) ?? null;
}

async function scoreUser(uid, entriesById) {
  const userRef = db.collection('users').doc(uid).collection('crystalBall');
  const snap = await userRef.get();
  if (snap.empty) return 0;

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  let scored = 0;

  for (const doc of snap.docs) {
    const entries = entriesById.get(doc.id);
    if (!entries || entries.length === 0) continue;
    const hasCanonical = entries.some((e) => typeof e.ans === 'string' && e.ans !== '');
    if (!hasCanonical) continue;

    const data = doc.data();
    if (typeof data.value !== 'string') continue;

    const match = findEntryForValue(entries, data.value);
    const points = match ? match.points : 0;
    batch.set(
      doc.ref,
      {
        points,
        scoredAt: nowIso,
        scoringVersion: SCORING_VERSION,
      },
      { merge: true },
    );
    scored++;
  }

  if (scored > 0) {
    await batch.commit();
  }
  return scored;
}

async function main() {
  const entriesById = await loadAnswers();

  const allEntries = [];
  for (const list of entriesById.values()) allEntries.push(...list);
  const unanswered = allEntries.filter((e) => typeof e.ans !== 'string' || e.ans === '');
  if (unanswered.length > 0) {
    console.warn(`Warning: ${unanswered.length} entries have no canonical "ans" and will be skipped:`);
    for (const e of unanswered) {
      console.warn(`  - ${e.id}${e.ans !== null && e.ans !== undefined ? ` (ans=${e.ans})` : ''}`);
    }
  }

  const uids = await listAllUserUids();
  if (uids.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`Scoring ${uids.length} user(s)...`);
  let totalScored = 0;
  for (const uid of uids) {
    try {
      const scored = await scoreUser(uid, entriesById);
      totalScored += scored;
      console.log(`  ${uid}: ${scored} prediction(s) scored.`);
    } catch (err) {
      console.error(`  ${uid}: failed -`, err);
    }
  }
  console.log(`Done. Total predictions scored: ${totalScored}.`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
