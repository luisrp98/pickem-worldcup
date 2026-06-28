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

function readPos(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  return null;
}

function isGroupRound(round) {
  return typeof round === 'string' && round.toLowerCase().startsWith('group');
}

async function readExistingPositions(uids) {
  const db = getFirestore();
  const refs = uids.map((uid) => db.collection('users').doc(uid));
  const snaps = await db.getAll(...refs);
  const map = new Map();
  for (const snap of snaps) {
    const cur = {
      currentPosition: null,
      groupCurrentPosition: null,
      knockoutCurrentPosition: null,
    };
    if (snap.exists) {
      const lb = snap.data()?.leaderboard;
      cur.currentPosition = readPos(lb?.currentPosition);
      cur.groupCurrentPosition = readPos(lb?.groupCurrentPosition);
      cur.knockoutCurrentPosition = readPos(lb?.knockoutCurrentPosition);
    }
    map.set(snap.id, cur);
  }
  return map;
}

async function loadOfficialCrystalBallAnswers(db) {
  const snap = await db.collection('crystalBall').doc('answers').get();
  const map = new Map();
  if (!snap.exists) return map;
  const entries = snap.data()?.entries;
  if (!Array.isArray(entries)) return map;
  for (const e of entries) {
    if (e && typeof e.id === 'string' && typeof e.ans === 'string') {
      map.set(e.id, e.ans);
    }
  }
  return map;
}

async function readUserAggregate(uid, officialAnswers) {
  const db = getFirestore();
  const [predictionsSnap, crystalBallSnap] = await Promise.all([
    db.collection('users').doc(uid).collection('predictions').get(),
    db.collection('users').doc(uid).collection('crystalBall').get(),
  ]);

  let points = 0;
  let correctResults = 0;
  let correctScores = 0;
  let groupPoints = 0;
  let groupCorrectResults = 0;
  let groupCorrectScores = 0;
  let knockoutPoints = 0;
  let knockoutCorrectResults = 0;
  let knockoutCorrectScores = 0;
  let crystalBallPoints = 0;
  let crystalBallCorrectCount = 0;
  let hasAnyMatchScored = false;
  let hasAnyCrystalBallScored = false;

  for (const doc of predictionsSnap.docs) {
    const data = doc.data();
    const isGroup = isGroupRound(data.round);

    if (typeof data.points === 'number') {
      points += data.points;
      if (isGroup) groupPoints += data.points;
      else knockoutPoints += data.points;
      hasAnyMatchScored = true;
    }
    if (data.resultado === true) {
      correctResults += 1;
      if (isGroup) groupCorrectResults += 1;
      else knockoutCorrectResults += 1;
    }
    if (data.marcador === true) {
      correctScores += 1;
      if (isGroup) groupCorrectScores += 1;
      else knockoutCorrectScores += 1;
    }
  }

  for (const doc of crystalBallSnap.docs) {
    const data = doc.data();
    if (typeof data.points === 'number') {
      crystalBallPoints += data.points;
      hasAnyCrystalBallScored = true;
    }
    if (typeof data.value === 'string' && officialAnswers.get(doc.id) === data.value) {
      crystalBallCorrectCount += 1;
    }
  }

  return {
    uid,
    points,
    correctResults,
    correctScores,
    groupPoints,
    groupCorrectResults,
    groupCorrectScores,
    knockoutPoints,
    knockoutCorrectResults,
    knockoutCorrectScores,
    crystalBallPoints,
    crystalBallCorrectCount,
    hasAnyScored: hasAnyMatchScored || hasAnyCrystalBallScored,
  };
}

function rankBy(items, pick) {
  const sorted = [...items].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (bv.primary !== av.primary) return bv.primary - av.primary;
    if (bv.secondary !== av.secondary) return bv.secondary - av.secondary;
    return bv.tertiary - av.tertiary;
  });
  const positions = new Map();
  sorted.forEach((item, idx) => {
    positions.set(item.uid, idx + 1);
  });
  return positions;
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

  let officialAnswers;
  try {
    officialAnswers = await loadOfficialCrystalBallAnswers(db);
  } catch (err) {
    console.error('recalculateLeaderboard: loadOfficialCrystalBallAnswers failed', err);
    return { ok: false, error: 'load-answers-failed' };
  }

  const aggregates = [];
  let totalScored = 0;
  for (const uid of uids) {
    try {
      const stats = await readUserAggregate(uid, officialAnswers);
      aggregates.push(stats);
      if (stats.hasAnyScored) totalScored += 1;
    } catch (err) {
      console.error(`recalculateLeaderboard: failed to read aggregates for ${uid}`, err);
    }
  }

  if (totalScored === 0) {
    console.log('recalculateLeaderboard: no scored predictions yet, skipping');
    return { ok: true, skipped: true };
  }

  const totalPositions = rankBy(aggregates, (a) => ({
    primary: a.points + a.crystalBallPoints,
    secondary: a.correctResults,
    tertiary: a.correctScores,
  }));
  const groupPositions = rankBy(aggregates, (a) => ({
    primary: a.groupPoints,
    secondary: a.groupCorrectResults,
    tertiary: a.groupCorrectScores,
  }));
  const knockoutPositions = rankBy(aggregates, (a) => ({
    primary: a.knockoutPoints,
    secondary: a.knockoutCorrectResults,
    tertiary: a.knockoutCorrectScores,
  }));
  const crystalBallPositions = rankBy(aggregates, (a) => ({
    primary: a.crystalBallPoints,
    secondary: a.crystalBallCorrectCount,
    tertiary: 0,
  }));

  const batch = db.batch();
  for (const agg of aggregates) {
    const prev = previousPositions.get(agg.uid) ?? {
      currentPosition: null,
      groupCurrentPosition: null,
      knockoutCurrentPosition: null,
    };
    const ref = db.collection('users').doc(agg.uid);
    batch.set(
      ref,
      {
        leaderboard: {
          currentPosition: totalPositions.get(agg.uid) ?? 0,
          previousPosition: prev.currentPosition,
          groupCurrentPosition: groupPositions.get(agg.uid) ?? 0,
          groupPreviousPosition: prev.groupCurrentPosition,
          knockoutCurrentPosition: knockoutPositions.get(agg.uid) ?? 0,
          knockoutPreviousPosition: prev.knockoutCurrentPosition,
          crystalBallCurrentPosition: crystalBallPositions.get(agg.uid) ?? 0,
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
