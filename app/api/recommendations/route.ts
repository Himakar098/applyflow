import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { getUtcDateKey } from "@/lib/services/usage-limits";
import { getRecommendationProvider } from "@/lib/recommendations/providers";
import { scoreJobs } from "@/lib/recommendations/match";
import { refineMatchReasons } from "@/lib/ai/openai";
import type { Profile } from "@/lib/types";
import type { RecommendationCache, RecommendedJob } from "@/lib/recommendations/types";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  console.error("api/recommendations", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

function preferenceCheck(profile?: Profile) {
  const missing: string[] = [];
  if (!profile?.targetRoles?.length) missing.push("Add target roles");
  if (!profile?.preferredLocations?.length) missing.push("Add preferred locations");
  if (!profile?.preferredWorkModes?.length) missing.push("Add work mode preference");
  if (!profile?.preferredSeniority?.length) missing.push("Add seniority preference");
  return missing;
}

function buildResponse(items: RecommendedJob[], cache: RecommendationCache) {
  const strong = items.filter((job) => job.matchScore >= 80);
  const medium = items.filter((job) => job.matchScore >= 60 && job.matchScore < 80);
  return {
    ok: true,
    date: cache.date,
    strong,
    medium,
    items,
    hiddenIds: cache.hiddenIds ?? [],
    savedIds: cache.savedIds ?? [],
    savedMap: cache.savedMap ?? {},
  };
}

export async function GET(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const dateKey = getUtcDateKey();
    const docRef = adminDb.collection("users").doc(uid).collection("recommendations").doc(dateKey);

    const profileSnap = await adminDb.collection("users").doc(uid).collection("profile").doc("current").get();
    const profileJson = profileSnap.data()?.profileJson as Profile | undefined;
    const missingPrefs = preferenceCheck(profileJson);
    if (missingPrefs.length) {
      return NextResponse.json(
        { ok: false, error: "PREFERENCES_REQUIRED", missing: missingPrefs, digest },
        { status: 412 },
      );
    }

    const cached = await docRef.get();
    if (cached.exists) {
      const data = cached.data() as RecommendationCache;
      const hidden = new Set(data.hiddenIds ?? []);
      const items = (data.items ?? []).filter((job) => !hidden.has(job.id));
      return NextResponse.json(buildResponse(items, data), { status: 200 });
    }

    const provider = getRecommendationProvider();
    const jobs = await provider.fetch({
      roles: profileJson?.targetRoles ?? [],
      locations: profileJson?.preferredLocations ?? [],
      workModes: profileJson?.preferredWorkModes ?? [],
    });

    let scored = scoreJobs(profileJson as Profile, jobs)
      .filter((job) => job.matchScore >= 55)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    if (process.env.RECOMMENDATIONS_USE_OPENAI === "true" && process.env.OPENAI_API_KEY) {
      const profileForAi = {
        targetRoles: profileJson?.targetRoles ?? [],
        preferredLocations: profileJson?.preferredLocations ?? [],
        preferredWorkModes: profileJson?.preferredWorkModes ?? [],
        preferredSeniority: profileJson?.preferredSeniority ?? [],
        skills: profileJson?.skills ?? { languages: [], tools: [], cloud: [], databases: [] },
        projects: profileJson?.projects ?? [],
        workExperience: profileJson?.workExperience ?? [],
      };

      scored = await Promise.all(
        scored.map(async (job) => {
          try {
            const refined = await refineMatchReasons({
              job: {
                title: job.title,
                company: job.company,
                location: job.location,
                description: job.description,
              },
              profile: profileForAi,
              reasons: job.matchReasons,
            });
            return { ...job, matchReasons: refined.reasons };
          } catch {
            return job;
          }
        }),
      );
    }

    const cache: RecommendationCache = {
      date: dateKey,
      items: scored,
      hiddenIds: [],
      savedIds: [],
      savedMap: {},
    };

    await docRef.set({
      ...cache,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(buildResponse(scored, cache), { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
