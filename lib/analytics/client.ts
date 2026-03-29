"use client";

import type { AnalyticsEventName } from "@/lib/analytics/types";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type AnalyticsProperties = Record<string, unknown>;

export async function trackAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): Promise<boolean> {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) return false;
    const res = await fetch("/api/analytics/event", {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, properties }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
