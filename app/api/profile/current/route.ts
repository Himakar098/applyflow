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

  console.error("api/profile/current", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  const digest = crypto.randomUUID();

  try {
    const { uid } = await verifyIdToken(req);

    const doc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("profile")
      .doc("current")
      .get();

    if (!doc.exists) {
      return NextResponse.json(
        { ok: false, error: "PROFILE_NOT_FOUND", digest },
        { status: 404 },
      );
    }

    const data = doc.data() || {};
    return NextResponse.json(
      {
        ok: true,
        profileJson: data.profileJson ?? null,
        resumeText: data.resumeText ?? "",
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
        digest,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest);
  }
}
