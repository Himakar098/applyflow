"use server";

import { adminDb } from "@/lib/firebase/admin";
import type { Profile } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";

const emptyProfile = (email?: string): Profile => ({
  fullName: "",
  email,
  visaStatus: "",
  targetRoles: [],
  preferredLocations: [],
  yearsExperienceApprox: undefined,
  skills: { languages: [], tools: [], cloud: [], databases: [] },
  workExperience: [],
  projects: [],
  education: [],
  certifications: [],
  hobbies: [],
  preferredTitles: [],
});

function normalizeProfile(data?: Partial<Profile>, email?: string): Profile {
  const base = emptyProfile(email);
  const skills = data?.skills ?? base.skills;

  return {
    ...base,
    ...data,
    skills: {
      languages: skills.languages ?? [],
      tools: skills.tools ?? [],
      cloud: skills.cloud ?? [],
      databases: skills.databases ?? [],
    },
    targetRoles: data?.targetRoles ?? base.targetRoles,
    preferredLocations: data?.preferredLocations ?? base.preferredLocations,
    workExperience: data?.workExperience ?? base.workExperience,
    projects: data?.projects ?? base.projects,
    education: data?.education ?? base.education,
    certifications: data?.certifications ?? base.certifications,
    hobbies: data?.hobbies ?? base.hobbies,
    preferredTitles: data?.preferredTitles ?? base.preferredTitles,
  };
}

export async function getProfile(
  idToken: string | null,
  email?: string | null,
): Promise<Profile> {
  const uid = await requireUserId(idToken);
  const docRef = adminDb.collection("users").doc(uid).collection("profile").doc("current");
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    const profile = normalizeProfile(undefined, email || undefined);
    await docRef.set({
      profileJson: profile,
      updatedAt: new Date().toISOString(),
    });
    return profile;
  }

  const data = snapshot.data() || {};
  const profileJson = normalizeProfile(data.profileJson as Partial<Profile>, email || undefined);
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

  const merged = normalizeProfile(
    {
      ...existing,
      ...payload,
      skills: {
        ...existing.skills,
        ...(payload.skills ?? {}),
      },
    },
    existing.email,
  );

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
