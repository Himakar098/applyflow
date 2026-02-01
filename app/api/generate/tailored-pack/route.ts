import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { generateTailoredPack } from "@/lib/ai/openai";
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

  console.error("api/generate/tailored-pack", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();

  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);

    const jobTitle = body?.jobTitle?.toString().trim();
    const company = body?.company?.toString().trim();
    const jobDescription = body?.jobDescription?.toString().trim();

    if (!jobTitle || !company || !jobDescription) {
      throw new HttpError(400, "jobTitle, company, and jobDescription are required");
    }

    if (jobDescription.length > 12000) {
      throw new HttpError(400, "Job description too long (max ~12k chars)");
    }

    const profileDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("profile")
      .doc("current")
      .get();

    const profileData = profileDoc.data();
    if (!profileData?.profileJson) {
      throw new HttpError(400, "Profile not found. Upload and extract a resume first.");
    }

    const output = await generateTailoredPack({
      profileJson: profileData.profileJson,
      jobTitle,
      company,
      jobDescription,
    });

    const genRef = adminDb.collection("users").doc(uid).collection("generations").doc();
    await genRef.set({
      jobTitle,
      company,
      jobDescription,
      output,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { ok: true, id: genRef.id, output, digest },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest);
  }
}
