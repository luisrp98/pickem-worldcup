import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App | undefined;
let adminAuth: Auth | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const projectId = import.meta.env.FIREBASE_PROJECT_ID;
  const clientEmail = import.meta.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = import.meta.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  if (getApps().length) {
    adminApp = getApps()[0];
  } else {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}
