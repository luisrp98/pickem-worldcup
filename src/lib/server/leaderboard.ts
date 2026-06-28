import type { LeaderboardEntry } from '../../data/leaderboard';
import { getAdminAuth, getAdminFirestore } from '../firebase/admin';
import { displayNameFromUser } from '../displayName';

interface UserAggregate {
  uid: string;
  displayName: string;
  points: number;
  correctResults: number;
  correctScores: number;
  groupPoints: number;
  groupCorrectResults: number;
  groupCorrectScores: number;
  knockoutPoints: number;
  knockoutCorrectResults: number;
  knockoutCorrectScores: number;
  crystalBallPoints: number;
  crystalBallCorrectCount: number;
  previousPosition: number | null;
  groupPreviousPosition: number | null;
  knockoutPreviousPosition: number | null;
}

function isGroupRound(group: unknown, round: unknown): boolean {
  if (typeof group === 'string' && group.length > 0) return true;
  if (typeof round === 'string' && round.toLowerCase().startsWith('group')) return true;
  return false;
}

function readPosition(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  return null;
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function loadOfficialCrystalBallAnswers(): Promise<Map<string, string>> {
  const db = getAdminFirestore();
  const snap = await db.collection('crystalBall').doc('answers').get();
  const map = new Map<string, string>();
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

async function aggregateUser(
  uid: string,
  email: string,
  officialAnswers: Map<string, string>,
): Promise<UserAggregate> {
  const db = getAdminFirestore();

  const [userSnap, predictionsSnap, crystalBallSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
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

  for (const doc of predictionsSnap.docs) {
    const data = doc.data();
    const isGroup = isGroupRound(data.group, data.round);

    if (typeof data.points === 'number') {
      points += data.points;
      if (isGroup) groupPoints += data.points;
      else knockoutPoints += data.points;
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

  let crystalBallPoints = 0;
  let crystalBallCorrectCount = 0;
  for (const doc of crystalBallSnap.docs) {
    const data = doc.data();
    crystalBallPoints += readNumber(data.points);
    if (typeof data.value === 'string' && officialAnswers.get(doc.id) === data.value) {
      crystalBallCorrectCount += 1;
    }
  }

  let previousPosition: number | null = null;
  let groupPreviousPosition: number | null = null;
  let knockoutPreviousPosition: number | null = null;
  if (userSnap.exists) {
    const userLeaderboard = userSnap.data()?.leaderboard;
    previousPosition = readPosition(userLeaderboard?.previousPosition);
    groupPreviousPosition = readPosition(userLeaderboard?.groupPreviousPosition);
    knockoutPreviousPosition = readPosition(userLeaderboard?.knockoutPreviousPosition);
  }

  const displayName = await displayNameFromUser(uid, email);

  return {
    uid,
    displayName,
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
    previousPosition,
    groupPreviousPosition,
    knockoutPreviousPosition,
  };
}

function rankBy<T>(
  items: T[],
  pick: (item: T) => { primary: number; secondary: number; tertiary: number },
): Map<string, number> {
  const sorted = [...items].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (bv.primary !== av.primary) return bv.primary - av.primary;
    if (bv.secondary !== av.secondary) return bv.secondary - av.secondary;
    return bv.tertiary - av.tertiary;
  });
  const positions = new Map<string, number>();
  sorted.forEach((item, idx) => {
    const anyItem = item as unknown as { uid: string };
    positions.set(anyItem.uid, idx + 1);
  });
  return positions;
}

export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  const auth = getAdminAuth();
  const listResult = await auth.listUsers(1000);
  const officialAnswers = await loadOfficialCrystalBallAnswers();

  const aggregates = await Promise.all(
    listResult.users.map((u) =>
      aggregateUser(u.uid, u.email ?? '', officialAnswers).catch((err) => {
        console.error(`loadLeaderboard: failed to aggregate user ${u.uid}`, err);
        return null;
      }),
    ),
  );

  const valid = aggregates.filter((a): a is UserAggregate => a !== null);

  const totalPositions = rankBy(valid, (a) => ({
    primary: a.points + a.crystalBallPoints,
    secondary: a.correctResults,
    tertiary: a.correctScores,
  }));
  const groupPositions = rankBy(valid, (a) => ({
    primary: a.groupPoints,
    secondary: a.groupCorrectResults,
    tertiary: a.groupCorrectScores,
  }));
  const knockoutPositions = rankBy(valid, (a) => ({
    primary: a.knockoutPoints,
    secondary: a.knockoutCorrectResults,
    tertiary: a.knockoutCorrectScores,
  }));
  const crystalBallPositions = rankBy(valid, (a) => ({
    primary: a.crystalBallPoints,
    secondary: a.crystalBallCorrectCount,
    tertiary: 0,
  }));

  return valid.map((agg) => {
    const totalPoints = agg.points + agg.crystalBallPoints;
    return {
      uid: agg.uid,
      displayName: agg.displayName,
      currentPosition: totalPositions.get(agg.uid) ?? 0,
      previousPosition: agg.previousPosition,
      points: agg.points,
      correctResults: agg.correctResults,
      correctScores: agg.correctScores,
      totalPoints,
      groupPoints: agg.groupPoints,
      groupCorrectResults: agg.groupCorrectResults,
      groupCorrectScores: agg.groupCorrectScores,
      groupCurrentPosition: groupPositions.get(agg.uid) ?? 0,
      groupPreviousPosition: agg.groupPreviousPosition,
      knockoutPoints: agg.knockoutPoints,
      knockoutCorrectResults: agg.knockoutCorrectResults,
      knockoutCorrectScores: agg.knockoutCorrectScores,
      knockoutCurrentPosition: knockoutPositions.get(agg.uid) ?? 0,
      knockoutPreviousPosition: agg.knockoutPreviousPosition,
      crystalBallPoints: agg.crystalBallPoints,
      crystalBallCorrectCount: agg.crystalBallCorrectCount,
      crystalBallCurrentPosition: crystalBallPositions.get(agg.uid) ?? 0,
    };
  });
}
