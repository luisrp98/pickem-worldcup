const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

const CRYSTAL_BALL_CONFIG = require('../src/data/crystalBallQuestions.json');

async function main() {
  const ref = db.collection('crystalBall').doc('answers');
  const existing = await ref.get();
  const existingEntries = Array.isArray(existing.data()?.entries) ? existing.data().entries : [];
  const existingById = new Map(existingEntries.map((e) => [e.id, e]));

  const merged = CRYSTAL_BALL_CONFIG.map((q) => {
    const prev = existingById.get(q.id);
    return {
      id: q.id,
      ans: prev && prev.ans !== undefined ? prev.ans : null,
      points: q.points,
    };
  });

  const existingData = existing.data() ?? {};
  await ref.set(
    {
      entries: merged,
      scoringVersion: 1,
      setAt: existingData.setAt ?? null,
    },
    { merge: true },
  );

  console.log(`Seeded ${merged.length} entries in crystalBall/answers.`);
  for (const entry of merged) {
    console.log(`  - ${entry.id}: points=${entry.points}, ans=${entry.ans === null ? '(not set)' : entry.ans}`);
  }
  console.log('Existing "ans" values were preserved (merge mode).');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
