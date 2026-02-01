// lib/firebase/config.ts
// Client-safe Firebase configuration
// IMPORTANT:
// - Only static NEXT_PUBLIC_* env access
// - No dynamic process.env[key]
// - No validation that throws at import time

export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string,
};

/**
 * Optional helper (safe)
 * Call this inside components if you want warnings in dev.
 */
export function warnIfFirebaseEnvMissing() {
  return;
}
