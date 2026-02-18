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
  const hasRoles = Boolean(
    profile?.targetRoles?.length ||
      profile?.preferredTitles?.length ||
      profile?.workExperience?.some((exp) => exp.role || exp.company),
  );
  if (!hasRoles) missing.push("Add target roles or work experience");

  const scope = profile?.preferredLocationScope;
  const hasScopedLocation =
    scope === "world"
      ? true
      : scope === "country"
        ? Boolean(profile?.preferredLocationCountry)
        : scope === "state"
          ? Boolean(profile?.preferredLocationState || profile?.preferredLocationCountry)
          : scope === "city"
            ? Boolean(
                profile?.preferredLocationCity ||
                  profile?.preferredLocationState ||
                  profile?.preferredLocationCountry,
              )
            : false;

  if (!profile?.preferredLocations?.length && !hasScopedLocation) {
    missing.push("Add preferred location scope");
  }
  if (!profile?.preferredWorkModes?.length) missing.push("Add work mode preference");
  if (!profile?.preferredSeniority?.length) missing.push("Add seniority preference");
  return missing;
}

type SearchHistoryItem = {
  query?: string;
  location?: string;
  remote?: string;
  jobType?: string;
  createdAt?: { toDate?: () => Date } | string | null;
};

const normalizeToken = (value: string) => value.trim();

const uniqueValues = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ROLE_EXPANSIONS: Record<string, string[]> = {
  "business analyst": ["data analyst", "product analyst", "operations analyst"],
  "data analyst": ["business analyst", "analytics analyst"],
  "product manager": ["product owner", "program manager", "growth product manager"],
  "project manager": ["program manager", "operations manager"],
  "software engineer": ["backend engineer", "frontend engineer", "full stack engineer"],
};

function expandRoles(roles: string[]) {
  const expanded = roles.flatMap((role) => {
    const lower = role.toLowerCase();
    const additions = Object.entries(ROLE_EXPANSIONS)
      .filter(([key]) => lower.includes(key))
      .flatMap(([, values]) => values);
    return [role, ...additions];
  });
  return uniqueValues(expanded);
}

function buildScopedLocation(profile: Profile) {
  const city = (profile.preferredLocationCity ?? "").trim();
  const state = (profile.preferredLocationState ?? "").trim();
  const country = (profile.preferredLocationCountry ?? "").trim();
  const scope = profile.preferredLocationScope ?? "city";

  if (scope === "world") return country;
  if (scope === "country") return country;
  if (scope === "state") return [state, country].filter(Boolean).join(", ");
  return [city, state, country].filter(Boolean).join(", ");
}

function derivePreferences(profile: Profile, searches: SearchHistoryItem[]) {
  const rolesFromProfile = [
    ...(profile.targetRoles ?? []),
    ...(profile.preferredTitles ?? []),
    ...(profile.workExperience ?? []).map((exp) => exp.role).filter(Boolean),
  ];
  const roles = expandRoles(
    uniqueValues([
      ...rolesFromProfile,
      ...searches.map((item) => item.query ?? "").filter(Boolean),
    ]),
  ).slice(0, 6);

  const scopedLocation = buildScopedLocation(profile);
  const locations = uniqueValues([
    scopedLocation,
    ...(profile.preferredLocations ?? []),
    ...searches.map((item) => item.location ?? "").filter(Boolean),
  ])
    .filter(Boolean)
    .slice(0, 5);

  const workModes = uniqueValues([
    ...(profile.preferredWorkModes ?? []),
    ...searches.map((item) => normalizeToken(item.remote ?? "")).filter((v) => v && v !== "any"),
  ]);

  return { roles, locations, workModes };
}

const MAX_JOB_AGE_DAYS = 30;

function isRecent(postedAt?: string) {
  if (!postedAt) return true;
  const parsed = new Date(postedAt);
  if (Number.isNaN(parsed.getTime())) return true;
  const diffDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_JOB_AGE_DAYS;
}

const CONSUMED_STATUSES = new Set(["applied", "interview", "offer"]);

async function getConsumedRecommendationIds(uid: string, savedMap: Record<string, string>) {
  const entries = Object.entries(savedMap).filter(([, jobId]) => Boolean(jobId));
  if (!entries.length) return [] as string[];

  const jobDocs = await Promise.all(
    entries.map(([, jobId]) =>
      adminDb.collection("users").doc(uid).collection("jobs").doc(jobId).get().catch(() => null),
    ),
  );

  return entries
    .filter((_, idx) => {
      const snap = jobDocs[idx];
      if (!snap?.exists) return false;
      const status = String(snap.data()?.status ?? "").toLowerCase();
      return CONSUMED_STATUSES.has(status);
    })
    .map(([recId]) => recId);
}

function buildResponse(
  items: RecommendedJob[],
  cache: RecommendationCache,
  warning?: string,
  meta?: {
    roles?: string[];
    location?: string | null;
    scope?: string | null;
    provider?: string;
  },
) {
  const strong = items.filter((job) => job.matchScore >= 80);
  const medium = items.filter((job) => job.matchScore >= 60 && job.matchScore < 80);
  return {
    ok: true,
    date: cache.date,
    provider: meta?.provider ?? cache.provider ?? "Unknown",
    appliedRoles: meta?.roles ?? [],
    appliedLocation: meta?.location ?? null,
    appliedScope: meta?.scope ?? null,
    warning,
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
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    const { uid } = await verifyIdToken(req);
    const dateKey = getUtcDateKey();
    const docRef = adminDb.collection("users").doc(uid).collection("recommendations").doc(dateKey);

    const profileSnap = await adminDb.collection("users").doc(uid).collection("profile").doc("current").get();
    const profileJson = profileSnap.data()?.profileJson as Profile | undefined;
    if (!profileJson) {
      return NextResponse.json(
        { ok: false, error: "PREFERENCES_REQUIRED", missing: ["Complete your profile"], digest },
        { status: 412 },
      );
    }

    const searchesSnap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("searches")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const searches = searchesSnap.docs.map((doc) => doc.data() as SearchHistoryItem);
    const derived = derivePreferences(profileJson, searches);
    const resolvedProfile: Profile = {
      ...profileJson,
      targetRoles: derived.roles,
      preferredLocations: derived.locations,
      preferredWorkModes: derived.workModes,
    };
    const appliedScope = resolvedProfile.preferredLocationScope ?? "city";
    const appliedLocation =
      derived.locations[0] ?? (appliedScope === "world" ? "Worldwide" : null);
    const responseMeta = {
      roles: derived.roles,
      location: appliedLocation,
      scope: appliedScope,
      provider: undefined as string | undefined,
    };

    const missingPrefs = preferenceCheck(resolvedProfile);
    if (missingPrefs.length) {
      return NextResponse.json(
        { ok: false, error: "PREFERENCES_REQUIRED", missing: missingPrefs, digest },
        { status: 412 },
      );
    }

    const provider = getRecommendationProvider();
    const cached = await docRef.get();
    const previousCache = cached.exists ? (cached.data() as RecommendationCache) : null;
    if (cached.exists && !forceRefresh) {
      const data = previousCache as RecommendationCache;
      const cacheIsReusable = data.provider === provider.name;

      if (cacheIsReusable) {
        const hidden = new Set(data.hiddenIds ?? []);
        const consumedIds = await getConsumedRecommendationIds(uid, data.savedMap ?? {});
        consumedIds.forEach((id) => hidden.add(id));
        if (consumedIds.length) {
          await docRef.set(
            {
              hiddenIds: FieldValue.arrayUnion(...consumedIds),
            },
            { merge: true },
          );
        }
        const items = (data.items ?? []).filter((job) => !hidden.has(job.id)).slice(0, 10);
        responseMeta.provider = provider.name;
        return NextResponse.json(
          buildResponse(items, { ...data, hiddenIds: Array.from(hidden) }, undefined, responseMeta),
          { status: 200 },
        );
      }
    }
    const jobs = await provider.fetch({
      roles: resolvedProfile.targetRoles ?? [],
      locations: resolvedProfile.preferredLocations ?? [],
      workModes: resolvedProfile.preferredWorkModes ?? [],
    });

    const recentJobs = jobs.filter((job) => isRecent(job.postedAt));
    const scope = resolvedProfile.preferredLocationScope ?? "city";
    const locationScopeWarning =
      scope === "world" && !resolvedProfile.preferredLocationCountry
        ? `${provider.name} supports country-specific searches; add a preferred country to expand results.`
        : undefined;
    const baseWarning =
      recentJobs.length === 0
        ? `${provider.name} returned no matches in the last ${MAX_JOB_AGE_DAYS} days for your preferences.`
        : undefined;
    const warning = [baseWarning, locationScopeWarning].filter(Boolean).join(" ") || undefined;

    let scored = scoreJobs(resolvedProfile as Profile, recentJobs)
      .filter((job) => job.matchScore >= 55)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    if (process.env.RECOMMENDATIONS_USE_OPENAI === "true" && process.env.OPENAI_API_KEY) {
      const profileForAi = {
        targetRoles: resolvedProfile?.targetRoles ?? [],
        preferredLocations: resolvedProfile?.preferredLocations ?? [],
        preferredWorkModes: resolvedProfile?.preferredWorkModes ?? [],
        preferredSeniority: resolvedProfile?.preferredSeniority ?? [],
        skills: resolvedProfile?.skills ?? { languages: [], tools: [], cloud: [], databases: [] },
        projects: resolvedProfile?.projects ?? [],
        workExperience: resolvedProfile?.workExperience ?? [],
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

    const consumedFromSaved = await getConsumedRecommendationIds(uid, previousCache?.savedMap ?? {});
    const hiddenIds = Array.from(
      new Set([...(previousCache?.hiddenIds ?? []), ...consumedFromSaved]),
    );
    const cache: RecommendationCache = {
      date: dateKey,
      provider: provider.name,
      items: scored.filter((job) => !hiddenIds.includes(job.id)),
      hiddenIds,
      savedIds: previousCache?.savedIds ?? [],
      savedMap: previousCache?.savedMap ?? {},
    };

    await docRef.set({
      ...cache,
      createdAt: FieldValue.serverTimestamp(),
    });

    responseMeta.provider = provider.name;
    const visibleItems = cache.items.slice(0, 10);
    return NextResponse.json(buildResponse(visibleItems, cache, warning, responseMeta), { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
