import { NextRequest, NextResponse } from "next/server";

import { verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { getUtcDateKey } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

const defaultDaily = (date: string) => ({
  date,
  xp: 0,
  events: {
    searchRuns: 0,
    jobsSaved: 0,
    recommendationsSaved: 0,
    applyChecklist: 0,
    profileSaved: 0,
  },
  completedJobIds: [],
});

const defaultMeta = () => ({
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  lifetimeXp: 0,
});

export async function GET(req: NextRequest) {
  const { uid } = await verifyIdToken(req);
  const dateKey = getUtcDateKey();

  const dailyRef = adminDb.collection("users").doc(uid).collection("gamification").doc(dateKey);
  const metaRef = adminDb.collection("users").doc(uid).collection("gamification").doc("meta");

  const [dailySnap, metaSnap] = await Promise.all([dailyRef.get(), metaRef.get()]);
  const daily = dailySnap.exists ? dailySnap.data() : defaultDaily(dateKey);
  const meta = metaSnap.exists ? metaSnap.data() : defaultMeta();

  return NextResponse.json(
    {
      daily,
      meta,
    },
    { status: 200 },
  );
}
