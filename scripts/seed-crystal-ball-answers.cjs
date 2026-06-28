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

function isTiered(q) {
  return q.pointsByValue && typeof q.pointsByValue === 'object';
}

function buildTemplate(config) {
  const out = [];
  for (const q of config) {
    if (isTiered(q)) {
      for (const [value, points] of Object.entries(q.pointsByValue)) {
        out.push({ id: q.id, ans: value, points });
      }
    } else {
      out.push({ id: q.id, ans: null, points: q.points });
    }
  }
  return out;
}

function buildExistingIndex(existingEntries) {
  const byId = new Map();
  for (const e of existingEntries) {
    if (!e || typeof e.id !== 'string') continue;
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const byIdAns = new Map();
  for (const e of existingEntries) {
    if (!e || typeof e.id !== 'string' || typeof e.ans !== 'string') continue;
    byIdAns.set(`${e.id}::${e.ans}`, e);
  }
  return { byId, byIdAns };
}

async function main() {
  const ref = db.collection('crystalBall').doc('answers');
  const existing = await ref.get();
  const existingEntries = Array.isArray(existing.data()?.entries) ? existing.data().entries : [];
  const { byId, byIdAns } = buildExistingIndex(existingEntries);

  const template = buildTemplate(CRYSTAL_BALL_CONFIG);

  const merged = template.map((entry) => {
    if (entry.ans === null) {
      const prev = byId.get(entry.id);
      if (prev && typeof prev.ans === 'string') {
        return { id: entry.id, ans: prev.ans, points: entry.points };
      }
      return { id: entry.id, ans: null, points: entry.points };
    }
    const prev = byIdAns.get(`${entry.id}::${entry.ans}`);
    if (prev && typeof prev.ans === 'string') {
      return { id: entry.id, ans: prev.ans, points: entry.points };
    }
    return entry;
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
    console.log(`  - ${entry.id} | ans=${entry.ans === null ? '(not set)' : entry.ans} | points=${entry.points}`);
  }
  console.log('Existing "ans" values were preserved (merge mode).');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
