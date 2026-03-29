import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { recordUserAnalyticsEvent } from "@/lib/analytics/server";
import type { AnalyticsEventName } from "@/lib/analytics/types";

export const runtime = "nodejs";

const EVENT_ALLOWLIST = new Set<AnalyticsEventName>([
  "signup_completed",
  "login_completed",
  "profile_saved",
  "search_run",
  "job_saved",
  "job_applied",
  "recommendation_saved",
  "recommendation_applied",
  "recommendation_refreshed",
]);

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  captureServerError(error, { route: "api/analytics/event", digest });
  console.error("api/analytics/event", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const body = (await req.json().catch(() => null)) as
      | { event?: string; properties?: Record<string, unknown> }
      | null;

    const event = (body?.event ?? "").toString() as AnalyticsEventName;
    if (!EVENT_ALLOWLIST.has(event)) {
      throw new HttpError(400, "invalid_event");
    }

    const properties = body?.properties && typeof body.properties === "object" ? body.properties : {};
    await recordUserAnalyticsEvent(uid, event, properties);

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
