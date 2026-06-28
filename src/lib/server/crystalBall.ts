import type { AstroCookies } from 'astro';
import { getAdminFirestore } from '../firebase/admin';
import { verifySession } from '../firebase/session';
import { crystalBallQuestions, type CrystalBallInputType } from '../../data/crystalBallQuestions';

export type CrystalBallAnswersMap = Record<string, string>;

export interface CrystalBallSettings {
  editable: boolean;
}

export interface CrystalBallEntry {
  questionId: string;
  emoji: string;
  question: string;
  inputType: CrystalBallInputType;
  userValue: string | null;
  officialValue: string | null;
  points: number | null;
  scoredAt: string | null;
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

export async function loadCrystalBallEntries(
  cookies: AstroCookies,
  targetUid?: string,
): Promise<CrystalBallEntry[]> {
  const user = await verifySession(cookies);
  if (!user) return [];
  const uid = targetUid ?? user.uid;
  const db = getAdminFirestore();

  const [answersSnap, predictionsSnap] = await Promise.all([
    db.collection('crystalBall').doc('answers').get(),
    db.collection('users').doc(uid).collection('crystalBall').get(),
  ]);

  const officialMap = new Map<string, string>();
  if (answersSnap.exists) {
    const data = answersSnap.data();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    for (const e of entries) {
      if (e && typeof e.id === 'string' && typeof e.ans === 'string' && e.ans !== '') {
        officialMap.set(e.id, e.ans);
      }
    }
  }

  const predictionsMap = new Map<string, { value: string; points: number | null; scoredAt: string | null }>();
  for (const doc of predictionsSnap.docs) {
    const data = doc.data();
    predictionsMap.set(doc.id, {
      value: typeof data.value === 'string' ? data.value : '',
      points: typeof data.points === 'number' ? data.points : null,
      scoredAt: typeof data.scoredAt === 'string' ? data.scoredAt : null,
    });
  }

  return crystalBallQuestions.map((q) => {
    const pred = predictionsMap.get(q.id);
    return {
      questionId: q.id,
      emoji: q.emoji,
      question: q.question,
      inputType: q.inputType,
      userValue: pred?.value ?? null,
      officialValue: officialMap.get(q.id) ?? null,
      points: pred?.points ?? null,
      scoredAt: pred?.scoredAt ?? null,
    };
  });
}
