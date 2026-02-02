import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/generations/by-job", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      throw new HttpError(400, "jobId is required");
    }

    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("generations")
      .where("jobId", "==", jobId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    const item = doc
      ? {
          id: doc.id,
          ...doc.data(),
        }
      : null;

    return NextResponse.json({ ok: true, item, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
