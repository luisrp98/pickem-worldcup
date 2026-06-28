import type { AstroCookies } from 'astro';
import { getAdminFirestore } from '../firebase/admin';
import { verifySession } from '../firebase/session';

export type CrystalBallAnswersMap = Record<string, string>;

export interface CrystalBallSettings {
  editable: boolean;
}

export async function loadCrystalBallAnswers(
  cookies: AstroCookies,
  targetUid?: string,
): Promise<CrystalBallAnswersMap> {
  const user = await verifySession(cookies);
  if (!user) return {};
  const uid = targetUid ?? user.uid;
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).collection('crystalBall').get();
  const out: CrystalBallAnswersMap = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.value === 'string') {
      out[doc.id] = data.value;
    }
  }
  return out;
}

export async function loadCrystalBallSettings(): Promise<CrystalBallSettings> {
  const db = getAdminFirestore();
  try {
    const snap = await db.collection('crystalBall').doc('settings').get();
    if (!snap.exists) return { editable: true };
    const data = snap.data();
    return { editable: data?.editable !== false };
  } catch (err) {
    console.error('loadCrystalBallSettings failed', err);
    return { editable: true };
  }
}
