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

  console.error("api/jobs/[jobId]", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const { jobId } = await context.params;
    if (!jobId) throw new HttpError(400, "jobId is required");

    const doc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("jobs")
      .doc(jobId)
      .get();

    if (!doc.exists) {
      throw new HttpError(404, "Job not found");
    }

    const data = doc.data() || {};

    return NextResponse.json(
      {
        ok: true,
        item: {
          id: doc.id,
          ...data,
        },
        digest,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest);
  }
}
