import type { AstroCookies } from 'astro';
import { getAdminFirestore } from '../firebase/admin';
import { verifySession } from '../firebase/session';

export interface StoredPredictionLite {
  score1: number;
  score2: number;
  date?: string;
}

export type PredictionsMap = Record<string, StoredPredictionLite>;

export async function loadPredictions(
  cookies: AstroCookies,
  targetUid?: string,
): Promise<PredictionsMap> {
  const user = await verifySession(cookies);
  if (!user) return {};

  const uid = targetUid ?? user.uid;
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).collection('predictions').get();

  const out: PredictionsMap = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.score1 === 'number' && typeof data.score2 === 'number') {
      out[doc.id] = {
        score1: data.score1,
        score2: data.score2,
        date: typeof data.date === 'string' ? data.date : undefined,
      };
    }
  }
  return out;
}
