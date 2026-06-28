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
  return data.entries;
}

async function scoreUser(uid, entriesById) {
  const userRef = db.collection('users').doc(uid).collection('crystalBall');
  const snap = await userRef.get();
  if (snap.empty) return 0;

  const nowIso = new Date().toISOString();
  const batch = db.batch();
  let scored = 0;

  for (const doc of snap.docs) {
    const entry = entriesById[doc.id];
    if (!entry) continue;
    if (entry.ans === null || entry.ans === undefined) continue;

    const data = doc.data();
    if (typeof data.value !== 'string') continue;

    const points = data.value === entry.ans ? entry.points : 0;
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
  const entries = await loadAnswers();
  const entriesById = Object.fromEntries(entries.map((e) => [e.id, e]));

  const unanswered = entries.filter((e) => e.ans === null || e.ans === undefined);
  if (unanswered.length > 0) {
    console.warn(`Warning: ${unanswered.length} entries have no official answer and will be skipped:`);
    for (const e of unanswered) {
      console.warn(`  - ${e.id}`);
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
