import type { APIRoute } from 'astro';
import { getAdminFirestore } from '../../../lib/firebase/admin';
import { verifySession } from '../../../lib/firebase/session';
import { loadTournament } from '../../../lib/sync';
import { getMatchStatus, type Match } from '../../../lib/matches';

export const prerender = false;

interface IncomingPrediction {
  matchId: string;
  score1: number;
  score2: number;
}

interface RequestBody {
  date?: unknown;
  predictions?: unknown;
}

const MAX_SCORE = 30;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;
}

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function buildMatchesById(matches: Match[]): Map<string, Match> {
  const map = new Map<string, Match>();
  for (const m of matches) {
    if (m?.id) map.set(m.id, m);
  }
  return map;
}

export const PUT: APIRoute = async ({ request, cookies }) => {
  const user = await verifySession(cookies);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'invalid-json' }, 400);
  }

  if (!isValidDate(body.date)) {
    return jsonResponse({ error: 'invalid-date' }, 400);
  }
  if (!Array.isArray(body.predictions)) {
    return jsonResponse({ error: 'invalid-predictions' }, 400);
  }

  const incoming = body.predictions as unknown[];
  const validated: IncomingPrediction[] = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.matchId !== 'string' || !p.matchId) continue;
    if (!isValidScore(p.score1) || !isValidScore(p.score2)) continue;
    validated.push({
      matchId: p.matchId,
      score1: p.score1,
      score2: p.score2,
    });
  }

  let tournament;
  try {
    tournament = await loadTournament();
  } catch (err) {
    console.error('loadTournament failed in PUT predictions/day', err);
    return jsonResponse({ error: 'tournament-unavailable' }, 503);
  }

  const matchesById = buildMatchesById(tournament.matches);
  const unknownIds: string[] = [];
  const closedIds: string[] = [];
  const now = new Date();
  for (const p of validated) {
    const match = matchesById.get(p.matchId);
    if (!match) {
      unknownIds.push(p.matchId);
      continue;
    }
    if (getMatchStatus(match, now) === 'closed') {
      closedIds.push(p.matchId);
    }
  }

  if (unknownIds.length > 0) {
    return jsonResponse({ error: 'unknown-match', matchIds: unknownIds }, 400);
  }
  if (closedIds.length > 0) {
    return jsonResponse({ error: 'match-closed', matchIds: closedIds }, 409);
  }

  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(user.uid);

  const existing = await userRef.collection('predictions').get();
  const existingIds = new Set(existing.docs.map((d) => d.id));

  const incomingIds = new Set(validated.map((p) => p.matchId));

  const batch = db.batch();
  const nowIso = new Date().toISOString();

  for (const p of validated) {
    const ref = userRef.collection('predictions').doc(p.matchId);
    batch.set(
      ref,
      {
        matchId: p.matchId,
        date: body.date,
        score1: p.score1,
        score2: p.score2,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  }

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      const ref = userRef.collection('predictions').doc(id);
      batch.delete(ref);
    }
  }

  await batch.commit();

  return jsonResponse({
    saved: validated.length,
    removed: [...existingIds].filter((id) => !incomingIds.has(id)).length,
    savedAt: nowIso,
  });
};

export const GET: APIRoute = async ({ cookies }) => {
  const user = await verifySession(cookies);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(user.uid).collection('predictions').get();

  const predictions: Record<string, { score1: number; score2: number; date?: string }> = {};
  for (const doc of snap.docs) {
    const data = doc.data() as { score1?: number; score2?: number; date?: string };
    if (typeof data.score1 === 'number' && typeof data.score2 === 'number') {
      predictions[doc.id] = {
        score1: data.score1,
        score2: data.score2,
        date: data.date,
      };
    }
  }

  return jsonResponse({ predictions });
};
