import type { AstroCookies } from 'astro';
import { getAdminFirestore } from '../firebase/admin';
import { verifySession } from '../firebase/session';

export type CrystalBallAnswersMap = Record<string, string>;

export async function loadCrystalBallAnswers(
  cookies: AstroCookies,
): Promise<CrystalBallAnswersMap> {
  const user = await verifySession(cookies);
  if (!user) return {};
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(user.uid).collection('crystalBall').get();
  const out: CrystalBallAnswersMap = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.value === 'string') {
      out[doc.id] = data.value;
    }
  }
  return out;
}
