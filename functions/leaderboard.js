const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

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

async function readExistingPositions(uids) {
  const db = getFirestore();
  const refs = uids.map((uid) => db.collection('users').doc(uid));
  const snaps = await db.getAll(...refs);
  const map = new Map();
  for (const snap of snaps) {
    if (!snap.exists) {
      map.set(snap.id, null);
      continue;
    }
    const data = snap.data();
    const cur = data?.leaderboard?.currentPosition;
    if (typeof cur === 'number' && Number.isInteger(cur) && cur > 0) {
      map.set(snap.id, cur);
    } else {
      map.set(snap.id, null);
    }
  }
  return map;
}

async function readUserAggregate(uid) {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).collection('predictions').get();
  let points = 0;
  let correctResults = 0;
  let correctScores = 0;
  let hasAnyScored = false;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.points === 'number') {
      points += data.points;
      hasAnyScored = true;
    }
    if (data.resultado === true) {
      correctResults += 1;
    }
    if (data.marcador === true) {
      correctScores += 1;
    }
  }
  return { uid, points, correctResults, correctScores, hasAnyScored };
}

async function recalculateLeaderboard(db) {
  let uids;
  try {
    uids = await listAllUserUids();
  } catch (err) {
    console.error('recalculateLeaderboard: listAllUserUids failed', err);
    return { ok: false, error: 'list-users-failed' };
  }
  if (uids.length === 0) {
    console.log('recalculateLeaderboard: no users, skipping');
    return { ok: true, skipped: true };
  }

  let previousPositions;
  try {
    previousPositions = await readExistingPositions(uids);
  } catch (err) {
    console.error('recalculateLeaderboard: readExistingPositions failed', err);
    return { ok: false, error: 'read-existing-failed' };
  }

  const aggregates = [];
  let totalScored = 0;
  for (const uid of uids) {
    try {
      const stats = await readUserAggregate(uid);
      aggregates.push(stats);
      if (stats.hasAnyScored) totalScored += 1;
    } catch (err) {
      console.error(`recalculateLeaderboard: failed to read predictions for ${uid}`, err);
    }
  }

  if (totalScored === 0) {
    console.log('recalculateLeaderboard: no scored predictions yet, skipping');
    return { ok: true, skipped: true };
  }

  aggregates.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults;
    return b.correctScores - a.correctScores;
  });

  const batch = db.batch();
  for (let i = 0; i < aggregates.length; i += 1) {
    const { uid } = aggregates[i];
    const currentPosition = i + 1;
    const previousPosition = previousPositions.get(uid) ?? null;
    const ref = db.collection('users').doc(uid);
    batch.set(
      ref,
      {
        leaderboard: {
          currentPosition,
          previousPosition,
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  }

  await batch.commit();
  console.log(`recalculateLeaderboard: updated ${aggregates.length} users`);
  return { ok: true, updated: aggregates.length };
}

module.exports = { recalculateLeaderboard };
