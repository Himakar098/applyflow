import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { getUtcDateKey } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  console.error("api/recommendations/hide", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);
    const jobId = body?.jobId?.toString();
    if (!jobId) throw new HttpError(400, "jobId is required");

    const dateKey = getUtcDateKey();
    const docRef = adminDb.collection("users").doc(uid).collection("recommendations").doc(dateKey);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpError(404, "No recommendations for today");

    await docRef.set(
      {
        hiddenIds: FieldValue.arrayUnion(jobId),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
