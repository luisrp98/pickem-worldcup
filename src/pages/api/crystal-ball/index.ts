import type { APIRoute } from 'astro';
import { getAdminFirestore } from '../../../lib/firebase/admin';
import { verifySession } from '../../../lib/firebase/session';
import { flags } from '../../../lib/matches';
import { crystalBallQuestions } from '../../../data/crystalBallQuestions';

export const prerender = false;

const TEAMS = Object.keys(flags);
const MAX_TEXT_LENGTH = 100;
const CRYSTAL_BALL_COLLECTION = 'crystalBall';

interface RequestBody {
  answers?: unknown;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidValue(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidTeamValue(value: string): boolean {
  return TEAMS.includes(value);
}

function isValidTextValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_LENGTH;
}

interface ValidatedAnswer {
  questionId: string;
  value: string;
}

export const GET: APIRoute = async ({ cookies }) => {
  const user = await verifySession(cookies);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const db = getAdminFirestore();
  const snap = await db
    .collection('users')
    .doc(user.uid)
    .collection(CRYSTAL_BALL_COLLECTION)
    .get();
  const answers: Record<string, string> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.value === 'string') {
      answers[doc.id] = data.value;
    }
  }
  return jsonResponse({ answers });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const user = await verifySession(cookies);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const db = getAdminFirestore();
  const settingsSnap = await db.collection('crystalBall').doc('settings').get();
  if (settingsSnap.exists) {
    const settingsData = settingsSnap.data();
    if (settingsData?.editable === false) {
      return jsonResponse({ error: 'crystal-ball-closed' }, 409);
    }
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'invalid-json' }, 400);
  }

  if (!body.answers || typeof body.answers !== 'object') {
    return jsonResponse({ error: 'invalid-payload' }, 400);
  }

  const incoming = body.answers as Record<string, unknown>;
  const validated: ValidatedAnswer[] = [];
  const errors: string[] = [];

  for (const [questionId, rawValue] of Object.entries(incoming)) {
    const question = crystalBallQuestions.find((q) => q.id === questionId);
    if (!question) {
      errors.push(`unknown-question:${questionId}`);
      continue;
    }
    if (!isValidValue(rawValue)) {
      errors.push(`invalid-value:${questionId}`);
      continue;
    }
    if (question.inputType === 'team') {
      if (!isValidTeamValue(rawValue)) {
        errors.push(`invalid-team:${questionId}`);
        continue;
      }
    } else {
      if (!isValidTextValue(rawValue)) {
        errors.push(`invalid-value:${questionId}`);
        continue;
      }
    }
    validated.push({ questionId, value: rawValue.trim() });
  }

  if (errors.length > 0) {
    return jsonResponse({ error: 'validation-failed', details: errors }, 400);
  }

  if (validated.length === 0) {
    return jsonResponse({ error: 'no-answers' }, 400);
  }

  const userRef = db.collection('users').doc(user.uid);
  const existing = await userRef.collection(CRYSTAL_BALL_COLLECTION).get();
  const existingIds = new Set(existing.docs.map((d) => d.id));

  const batch = db.batch();
  const nowIso = new Date().toISOString();

  for (const { questionId, value } of validated) {
    const ref = userRef.collection(CRYSTAL_BALL_COLLECTION).doc(questionId);
    const data: Record<string, unknown> = {
      value,
      updatedAt: nowIso,
    };
    if (!existingIds.has(questionId)) {
      data.createdAt = nowIso;
    }
    batch.set(ref, data, { merge: true });
  }

  await batch.commit();

  return jsonResponse({
    saved: validated.length,
    savedAt: nowIso,
  });
};
