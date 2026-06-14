import type { AstroCookies } from 'astro';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from './admin';

export const SESSION_COOKIE_NAME = '__session';

export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  email_verified: boolean;
}

function toSessionUser(decoded: DecodedIdToken): SessionUser | null {
  if (!decoded.uid || !decoded.email) return null;
  return {
    uid: decoded.uid,
    email: decoded.email,
    email_verified: Boolean(decoded.email_verified),
  };
}

export async function createSession(
  idToken: string,
  cookies: AstroCookies
): Promise<SessionUser> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const user = toSessionUser(decoded);
  if (!user) {
    throw new Error('ID token missing uid or email');
  }
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return user;
}

export async function verifySession(
  cookies: AstroCookies
): Promise<SessionUser | null> {
  const cookie = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(cookie, false);
    return toSessionUser(decoded);
  } catch {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    return null;
  }
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
