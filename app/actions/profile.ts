"use server";

import { adminDb } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";
import { emptyProfile, normalizeProfile } from "@/lib/profile/normalize";

const emptyProfileWithEmail = (email?: string): Profile => ({
  ...emptyProfile(),
  email,
});

export async function getProfile(
  idToken: string | null,
  email?: string | null,
): Promise<Profile> {
  const uid = await requireUserId(idToken);
  const docRef = adminDb.collection("users").doc(uid).collection("profile").doc("current");
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    const profile = emptyProfileWithEmail(email || undefined);
    await docRef.set({
      profileJson: profile,
      updatedAt: new Date().toISOString(),
    });
    return profile;
  }

  const data = snapshot.data() || {};
  const profileJson = normalizeProfile(data.profileJson as Partial<Profile>);
  if (email && !profileJson.email) profileJson.email = email;
  return {
    ...profileJson,
    resumeText: data.resumeText,
    updatedAt: data.updatedAt ?? profileJson.updatedAt,
  };
}

export async function updateProfile(
  idToken: string | null,
  payload: Partial<Profile>,
): Promise<Profile> {
  const uid = await requireUserId(idToken);
  const docRef = adminDb.collection("users").doc(uid).collection("profile").doc("current");
  const snapshot = await docRef.get();
  const existing = normalizeProfile(snapshot.data()?.profileJson as Partial<Profile> | undefined);

  const merged = normalizeProfile({
    ...existing,
    ...payload,
    skills: {
      ...existing.skills,
      ...(payload.skills ?? {}),
    },
  });

  const now = new Date().toISOString();
  await docRef.set(
    {
      profileJson: merged,
      updatedAt: now,
    },
    { merge: true },
  );

  const updatedSnap = await docRef.get();
  const updatedData = updatedSnap.data() || {};
  return normalizeProfile(updatedData.profileJson as Partial<Profile> | undefined);
}
