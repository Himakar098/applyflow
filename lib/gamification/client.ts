"use client";

import { getAuthHeader } from "@/lib/firebase/getIdToken";

export type GamificationEventType =
  | "search_run"
  | "job_saved"
  | "recommendation_saved"
  | "apply_checklist_complete"
  | "profile_saved";

export type GamificationDaily = {
  date: string;
  xp: number;
  events: {
    searchRuns: number;
    jobsSaved: number;
    recommendationsSaved: number;
    applyChecklist: number;
    profileSaved: number;
  };
  completedJobIds?: string[];
};

export type GamificationMeta = {
  streak: number;
  bestStreak: number;
  lastActiveDate?: string | null;
  lifetimeXp: number;
};

export type GamificationState = {
  daily: GamificationDaily;
  meta: GamificationMeta;
};

export async function fetchGamificationDaily(): Promise<GamificationState | null> {
  const headers = await getAuthHeader();
  if (!headers) return null;
  const res = await fetch("/api/gamification/daily", { headers });
  if (!res.ok) return null;
  return (await res.json()) as GamificationState;
}

export async function trackGamificationEvent(
  type: GamificationEventType,
  jobId?: string,
): Promise<GamificationState | null> {
  const headers = await getAuthHeader();
  if (!headers) return null;
  const res = await fetch("/api/gamification/event", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ type, jobId }),
  });
  if (!res.ok) return null;
  return (await res.json()) as GamificationState;
}
