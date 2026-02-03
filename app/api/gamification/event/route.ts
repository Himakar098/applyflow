import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { getUtcDateKey } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

type EventType =
  | "search_run"
  | "job_saved"
  | "recommendation_saved"
  | "apply_checklist_complete"
  | "profile_saved";

const EVENT_CONFIG: Record<
  EventType,
  { xp: number; cap: number; field: keyof DailyEvents }
> = {
  search_run: { xp: 10, cap: 3, field: "searchRuns" },
  job_saved: { xp: 20, cap: 3, field: "jobsSaved" },
  recommendation_saved: { xp: 20, cap: 3, field: "recommendationsSaved" },
  apply_checklist_complete: { xp: 40, cap: 2, field: "applyChecklist" },
  profile_saved: { xp: 30, cap: 1, field: "profileSaved" },
};

type DailyEvents = {
  searchRuns: number;
  jobsSaved: number;
  recommendationsSaved: number;
  applyChecklist: number;
  profileSaved: number;
};

const defaultDaily = (date: string) => ({
  date,
  xp: 0,
  events: {
    searchRuns: 0,
    jobsSaved: 0,
    recommendationsSaved: 0,
    applyChecklist: 0,
    profileSaved: 0,
  } as DailyEvents,
  completedJobIds: [] as string[],
});

const defaultMeta = () => ({
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null as string | null,
  lifetimeXp: 0,
});

function getYesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  console.error("api/gamification/event", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);
    const type = body?.type as EventType | undefined;
    const jobId = body?.jobId?.toString();

    if (!type || !(type in EVENT_CONFIG)) {
      throw new HttpError(400, "Invalid event type");
    }

    const dateKey = getUtcDateKey();
    const yesterdayKey = getYesterdayKey();

    const dailyRef = adminDb.collection("users").doc(uid).collection("gamification").doc(dateKey);
    const metaRef = adminDb.collection("users").doc(uid).collection("gamification").doc("meta");

    const result = await adminDb.runTransaction(async (tx) => {
      const [dailySnap, metaSnap] = await Promise.all([tx.get(dailyRef), tx.get(metaRef)]);
      const daily = (dailySnap.exists ? dailySnap.data() : null) ?? defaultDaily(dateKey);
      const meta = (metaSnap.exists ? metaSnap.data() : null) ?? defaultMeta();

      const events = { ...(daily.events as DailyEvents) };
      const config = EVENT_CONFIG[type];
      const current = Number(events[config.field] ?? 0);

      const completedJobIds = Array.isArray(daily.completedJobIds) ? [...daily.completedJobIds] : [];
      let increment = 0;

      if (type === "apply_checklist_complete") {
        if (!jobId) {
          throw new HttpError(400, "jobId is required for apply_checklist_complete");
        }
        if (completedJobIds.includes(jobId)) {
          increment = 0;
        } else if (current < config.cap) {
          completedJobIds.push(jobId);
          events[config.field] = current + 1;
          increment = config.xp;
        } else {
          completedJobIds.push(jobId);
        }
      } else if (current < config.cap) {
        events[config.field] = current + 1;
        increment = config.xp;
      }

      const nextXp = Number(daily.xp ?? 0) + increment;
      const dailyUpdate = {
        date: dateKey,
        xp: nextXp,
        events,
        completedJobIds,
        updatedAt: FieldValue.serverTimestamp(),
      };

      const lastActive = meta.lastActiveDate ?? null;
      let streak = Number(meta.streak ?? 0);
      if (lastActive !== dateKey) {
        streak = lastActive === yesterdayKey ? streak + 1 : 1;
      }
      const bestStreak = Math.max(Number(meta.bestStreak ?? 0), streak);
      const lifetimeXp = Number(meta.lifetimeXp ?? 0) + increment;

      const metaUpdate = {
        lastActiveDate: dateKey,
        streak,
        bestStreak,
        lifetimeXp,
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(dailyRef, dailyUpdate, { merge: true });
      tx.set(metaRef, metaUpdate, { merge: true });

      return {
        daily: { ...daily, ...dailyUpdate, xp: nextXp, events, completedJobIds },
        meta: { ...meta, ...metaUpdate, streak, bestStreak, lifetimeXp },
      };
    });

    return NextResponse.json({ ...result }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
