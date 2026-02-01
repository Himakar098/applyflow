import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { extractProfile } from "@/lib/ai/openai";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { extractResumeText } from "@/lib/resume/extract-text";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/profile/extract", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();

  try {
    const { uid, decoded } = await verifyIdToken(req);

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) {
      throw new HttpError(400, "Missing resume file");
    }

    const resumeText = await extractResumeText(file);
    const profileJson = await extractProfile(resumeText);

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
        resumeText,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, profileJson, digest });
  } catch (error) {
    return handleError(error, digest);
  }
}
