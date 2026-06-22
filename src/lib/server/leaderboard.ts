import type { LeaderboardEntry } from '../../data/leaderboard';
import { getAdminAuth, getAdminFirestore } from '../firebase/admin';
import { displayNameFromUser } from '../displayName';

interface UserAggregate {
  uid: string;
  displayName: string;
  points: number;
  correctResults: number;
  correctScores: number;
  previousPosition: number | null;
}

async function aggregateUser(uid: string, email: string): Promise<UserAggregate> {
  const db = getAdminFirestore();

  const [userSnap, predictionsSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(uid).collection('predictions').get(),
  ]);

  let points = 0;
  let correctResults = 0;
  let correctScores = 0;
  for (const doc of predictionsSnap.docs) {
    const data = doc.data();
    if (typeof data.points === 'number') {
      points += data.points;
    }
    if (data.resultado === true) {
      correctResults += 1;
    }
    if (data.marcador === true) {
      correctScores += 1;
    }
  }

  let previousPosition: number | null = null;
  if (userSnap.exists) {
    const data = userSnap.data();
    const prev = data?.leaderboard?.previousPosition;
    if (typeof prev === 'number' && Number.isInteger(prev) && prev > 0) {
      previousPosition = prev;
    }
  }

  const displayName = await displayNameFromUser(uid, email);

  return {
    uid,
    displayName,
    points,
    correctResults,
    correctScores,
    previousPosition,
  };
}

export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  const auth = getAdminAuth();
  const listResult = await auth.listUsers(1000);

  const aggregates = await Promise.all(
    listResult.users.map((u) =>
      aggregateUser(u.uid, u.email ?? '').catch((err) => {
        console.error(`loadLeaderboard: failed to aggregate user ${u.uid}`, err);
        return null;
      }),
    ),
  );

  const valid = aggregates.filter((a): a is UserAggregate => a !== null);

  valid.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults;
    return b.correctScores - a.correctScores;
  });

  return valid.map((agg, idx) => ({
    uid: agg.uid,
    displayName: agg.displayName,
    currentPosition: idx + 1,
    previousPosition: agg.previousPosition,
    points: agg.points,
    correctResults: agg.correctResults,
    correctScores: agg.correctScores,
  }));
}
