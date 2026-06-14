import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/firebase/session';

const PUBLIC_EXACT = new Set(['/login', '/logout']);
const PUBLIC_PREFIXES = ['/_astro/', '/_image', '/favicon', '/api/auth/', '/assets/', '/reglas'];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isPublicPath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  if (PUBLIC_EXACT.has(normalized)) return true;
  return PUBLIC_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (isPublicPath(context.url.pathname)) {
    return next();
  }

  const user = await verifySession(context.cookies);
  context.locals.user = user;

  if (!user) {
    const from = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`/login?from=${from}`);
  }

  return next();
});
