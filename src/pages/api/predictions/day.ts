import type { APIRoute } from 'astro';
import { getAdminFirestore } from '../../../lib/firebase/admin';
import { verifySession } from '../../../lib/firebase/session';
import { loadTournament } from '../../../lib/sync';
import { getMatchStatus, parseKickoff, type Match } from '../../../lib/matches';
import { SCORING_VERSION, type StoredPrediction } from '../../../lib/scoring';

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
  const lockedIds: string[] = [];
  const now = new Date();
  for (const p of validated) {
    const match = matchesById.get(p.matchId);
    if (!match) {
      unknownIds.push(p.matchId);
      continue;
    }
    if (getMatchStatus(match, now) !== 'pending') {
      lockedIds.push(p.matchId);
    }
  }

  if (unknownIds.length > 0) {
    return jsonResponse({ error: 'unknown-match', matchIds: unknownIds }, 400);
  }
  if (lockedIds.length > 0) {
    return jsonResponse({ error: 'match-locked', matchIds: lockedIds }, 409);
  }

  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(user.uid);

  const existing = await userRef.collection('predictions').get();
  const existingIds = new Set(existing.docs.map((d) => d.id));

  const batch = db.batch();
  const nowIso = new Date().toISOString();

  for (const p of validated) {
    const match = matchesById.get(p.matchId);
    if (!match) continue;

    const kickoff = parseKickoff(match);
    const kickoffAt = kickoff ? kickoff.toISOString() : '';

    const ref = userRef.collection('predictions').doc(p.matchId);
    const data: Record<string, unknown> = {
      matchId: p.matchId,
      round: match.round ?? '',
      group: match.group ?? null,
      team1: match.team1,
      team2: match.team2,
      kickoffAt,
      score1: p.score1,
      score2: p.score2,
      updatedAt: nowIso,
      scoringVersion: SCORING_VERSION,
    };

    if (!existingIds.has(p.matchId)) {
      data.createdAt = nowIso;
    }

    batch.set(ref, data, { merge: true });
  }

  await batch.commit();

  return jsonResponse({
    saved: validated.length,
    removed: 0,
    savedAt: nowIso,
  });
};

export const GET: APIRoute = async ({ cookies }) => {
  const user = await verifySession(cookies);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(user.uid).collection('predictions').get();

  const predictions: Record<string, StoredPrediction> = {};
  for (const doc of snap.docs) {
    const data = doc.data() as Partial<StoredPrediction>;
    if (typeof data.score1 !== 'number' || typeof data.score2 !== 'number') continue;
    predictions[doc.id] = {
      matchId: doc.id,
      score1: data.score1,
      score2: data.score2,
      round: data.round ?? '',
      group: data.group ?? null,
      team1: data.team1 ?? '',
      team2: data.team2 ?? '',
      kickoffAt: data.kickoffAt ?? '',
      createdAt: data.createdAt ?? '',
      updatedAt: data.updatedAt ?? '',
      points: data.points ?? null,
      resultado: data.resultado ?? null,
      marcador: data.marcador ?? null,
      scoredAt: data.scoredAt ?? null,
      scoringVersion: data.scoringVersion ?? SCORING_VERSION,
    };
  }

  return jsonResponse({ predictions });
};
