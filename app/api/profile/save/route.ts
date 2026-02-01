import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

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

  console.error("api/profile/save", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();

  try {
    const { uid, decoded } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);

    const profileJson = body?.profileJson;
    if (!profileJson || typeof profileJson !== "object") {
      throw new HttpError(400, "profileJson is required");
    }

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set(
      {
        email: decoded?.email ?? null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await userRef.collection("profile").doc("current").set(
      {
        profileJson,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, profileJson, digest });
  } catch (error) {
    return handleError(error, digest);
  }
}
