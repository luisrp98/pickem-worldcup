import type { APIRoute } from 'astro';
import { loadTournament } from '../../lib/sync';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const tournament = await loadTournament();
    return jsonResponse({ tournament });
  } catch (err) {
    console.error('loadTournament failed', err);
    return jsonResponse(
      { error: 'tournament-unavailable', message: err instanceof Error ? err.message : 'unknown' },
      503
    );
  }
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
