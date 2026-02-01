"use server";

import { adminDb } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";

const defaultProfile = (uid: string, email?: string): Profile => ({
  id: uid,
  fullName: "",
  email,
  preferredTitles: [],
  preferredLocations: [],
  visaStatus: "Not set",
  updatedAt: new Date().toISOString(),
});

export async function getProfile(
  idToken: string | null,
  email?: string | null,
): Promise<Profile> {
  const uid = await requireUserId(idToken);
  const docRef = adminDb.collection("users").doc(uid);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    const profile = defaultProfile(uid, email || undefined);
    await docRef.set(profile);
    return profile;
  }

  return snapshot.data() as Profile;
}

export async function updateProfile(
  idToken: string | null,
  payload: Partial<Profile>,
): Promise<Profile> {
  const uid = await requireUserId(idToken);
  const docRef = adminDb.collection("users").doc(uid);
  const now = new Date().toISOString();

  await docRef.set(
    {
      ...payload,
      updatedAt: now,
    },
    { merge: true },
  );

  const snapshot = await docRef.get();
  return snapshot.data() as Profile;
}
