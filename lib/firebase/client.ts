// lib/firebase/client.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseClientConfig } from "./config";

// Initialize Firebase app (singleton)
export const app =
  getApps().length > 0 ? getApp() : initializeApp(firebaseClientConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const useEmulators =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

if (useEmulators) {
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  const firestoreHost =
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const storageHost =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";

  // Prevent duplicate emulator connections during HMR.
  const emulatorFlag = globalThis as typeof globalThis & {
    __applyflowFirebaseEmulatorsConnected?: boolean;
  };

  if (!emulatorFlag.__applyflowFirebaseEmulatorsConnected) {
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });

    const [firestoreHostname, firestorePort] = firestoreHost.split(":");
    connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));

    const [storageHostname, storagePort] = storageHost.split(":");
    connectStorageEmulator(storage, storageHostname, Number(storagePort));

    emulatorFlag.__applyflowFirebaseEmulatorsConnected = true;
  }
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
