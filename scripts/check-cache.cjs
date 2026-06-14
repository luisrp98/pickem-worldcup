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

async function main() {
  console.log('Project:', projectId);
  console.log('---');
  const cacheSnap = await db.collection('cache').get();
  console.log('Total cache docs:', cacheSnap.size);
  const ids = cacheSnap.docs.map((d) => d.id);
  ids.sort();
  console.log('IDs in cache/ collection:');
  for (const id of ids) console.log('  -', id);

  const meta = cacheSnap.docs.find((d) => d.id === '_tournament');
  if (meta) {
    console.log('---');
    console.log('_tournament doc:', JSON.stringify(meta.data(), null, 2));
  } else {
    console.log('---');
    console.log('_tournament doc: <MISSING>');
  }

  const legacy = cacheSnap.docs.find((d) => d.id === 'tournament');
  console.log('---');
  console.log('Legacy wrapper "tournament" present:', !!legacy);

  const metaSync = await db.collection('meta').doc('sync').get();
  if (metaSync.exists) {
    console.log('---');
    console.log('meta/sync:', JSON.stringify(metaSync.data(), null, 2));
  } else {
    console.log('---');
    console.log('meta/sync: <MISSING>');
  }

  const matchCount = cacheSnap.docs.filter((d) => d.id !== '_tournament' && d.id !== 'tournament').length;
  console.log('---');
  console.log('Match docs (excluding meta/legacy):', matchCount);

  if (matchCount > 0) {
    const sample = cacheSnap.docs.find((d) => d.id.includes('__'));
    if (sample) {
      console.log('---');
      console.log('Sample match doc [' + sample.id + ']:');
      const data = sample.data();
      console.log('  id:', data.id);
      console.log('  date:', data.date);
      console.log('  team1:', data.team1);
      console.log('  team2:', data.team2);
      console.log('  _updatedAt:', data._updatedAt);
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
