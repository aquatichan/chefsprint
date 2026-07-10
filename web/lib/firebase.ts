"use client";

// Optional Firebase client. If NEXT_PUBLIC_FIREBASE_* env vars aren't set, the app
// runs in open local mode (no sign-in required) against a local engine.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

let cachedApp: FirebaseApp | undefined;

function app(): FirebaseApp | null {
  if (!firebaseEnabled) return null;
  if (!cachedApp) cachedApp = getApps()[0] ?? initializeApp(config);
  return cachedApp;
}

export function auth(): Auth | null {
  const a = app();
  return a ? getAuth(a) : null;
}

export async function signInWithGoogle(): Promise<User | null> {
  const a = auth();
  if (!a) return null;
  const result = await signInWithPopup(a, new GoogleAuthProvider());
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const a = auth();
  if (a) await signOut(a);
}

export function watchUser(cb: (user: User | null) => void): () => void {
  const a = auth();
  if (!a) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(a, cb);
}

export type { User };
