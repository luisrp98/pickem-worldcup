import type { APIRoute } from 'astro';
import { createSession } from '../../../lib/firebase/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { idToken?: unknown };
  try {
    body = (await request.json()) as { idToken?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid-json' }, 400);
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken : '';
  if (!idToken) {
    return jsonResponse({ error: 'missing-id-token' }, 400);
  }

  try {
    const user = await createSession(idToken, cookies);
    return jsonResponse({ user });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code?.startsWith('auth/')) {
      return jsonResponse({ error: code }, 401);
    }
    console.error('session creation failed', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
