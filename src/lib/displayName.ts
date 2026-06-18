import { getAdminAuth, getAdminFirestore } from './firebase/admin';

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extracts up to two initials from a display name.
 * - "Martín López" -> "ML"
 * - "Sofía"        -> "SO"
 * - "ana"          -> "A" (only one part available, falls back to first chars)
 */
export function initialsFromName(name: string): string {
  const normalized = stripDiacritics(name.trim());
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
}

/**
 * Derives initials from an email by splitting the local part on separators.
 * - "martin.lopez@gmail.com" -> "ML"
 * - "luisito@gmail.com"      -> "LU"
 */
export function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return initialsFromName(local.replace(/[._-]+/g, ' '));
}

/**
 * Derives a human-friendly display name from an email's local part.
 * - "martin.lopez@gmail.com" -> "Martin Lopez"
 * - "luisito@gmail.com"      -> "Luisito"
 */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves the display name for a user.
 * Reads `users/{uid}.displayName` from Firestore; falls back to a name
 * derived from the email's local part if the doc or field is missing.
 * The fallback is NOT persisted back to Firestore.
 */
export async function displayNameFromUser(uid: string, email: string): Promise<string> {
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists) {
    const data = snap.data();
    if (typeof data?.displayName === 'string' && data.displayName.trim().length > 0) {
      return data.displayName.trim();
    }
  }
  return nameFromEmail(email);
}

/**
 * Resolves a display name for a user by UID, without needing the email
 * up front. Reads users/{uid}.displayName from Firestore; if missing or
 * empty, fetches the email from Firebase Auth and derives a name from it.
 * The fallback is NOT persisted.
 */
export async function resolveDisplayName(uid: string): Promise<string> {
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists) {
    const data = snap.data();
    if (typeof data?.displayName === 'string' && data.displayName.trim().length > 0) {
      return data.displayName.trim();
    }
  }
  try {
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(uid);
    return nameFromEmail(userRecord.email ?? '');
  } catch {
    return uid;
  }
}
