import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import type { AnalyticsEventName } from "@/lib/analytics/types";

type AnalyticsProperties = Record<string, unknown>;

const ACTIVATION_EVENTS = new Set<AnalyticsEventName>([
  "profile_saved",
  "search_run",
  "job_saved",
  "recommendation_saved",
  "recommendation_applied",
  "job_applied",
]);

const APPLY_EVENTS = new Set<AnalyticsEventName>(["recommendation_applied", "job_applied"]);

export async function recordUserAnalyticsEvent(
  uid: string,
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  const userRef = adminDb.collection("users").doc(uid);
  const eventRef = userRef.collection("analyticsEvents").doc();
  const summaryRef = userRef.collection("analytics").doc("summary");

  await eventRef.set({
    event,
    properties,
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });

  await adminDb.runTransaction(async (tx) => {
    const summarySnap = await tx.get(summaryRef);
    const summary = summarySnap.data() ?? {};
    const patch: Record<string, unknown> = {
      lastSeenAt: FieldValue.serverTimestamp(),
      [`counters.${event}`]: FieldValue.increment(1),
    };

    if (!summary.firstSeenAt) {
      patch.firstSeenAt = FieldValue.serverTimestamp();
    }
    if (!summary.activatedAt && ACTIVATION_EVENTS.has(event)) {
      patch.activatedAt = FieldValue.serverTimestamp();
    }
    if (!summary.firstApplyAt && APPLY_EVENTS.has(event)) {
      patch.firstApplyAt = FieldValue.serverTimestamp();
    }

    tx.set(summaryRef, patch, { merge: true });
  });
}
