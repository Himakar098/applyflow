import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { extractProfile } from "@/lib/ai/openai";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { extractResumeText } from "@/lib/resume/extract-text";
import { hashIp, writeLog } from "@/lib/services/ai-logger";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    if (error.message === "RESUME_EXTRACT_FAILED") {
      return NextResponse.json(
        { ok: false, error: "RESUME_EXTRACT_FAILED", digest },
        { status: 422 },
      );
    }
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
  const started = Date.now();
  let uid = "unknown";

  try {
    const verified = await verifyIdToken(req);
    uid = verified.uid;
    const decoded = verified.decoded;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "AI_NOT_CONFIGURED", digest },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("resume");
    if (!(file instanceof File)) {
      throw new HttpError(400, "Missing resume file");
    }

    const usageCheck = await checkAndIncrementUsage({
      uid,
      kind: "resume_extract",
      increment: 1,
      adminDb,
    });

    if (!usageCheck.allowed) {
      await writeLog(uid, {
        type: "resume_extract",
        status: "blocked",
        digest,
        errorCode: "DAILY_LIMIT_REACHED",
        errorMessage: usageCheck.limitType,
        latencyMs: Date.now() - started,
        ipHash: hashIp(req),
      });
      return NextResponse.json(
        { ok: false, error: "DAILY_LIMIT_REACHED", limitType: usageCheck.limitType, digest },
        { status: 429 },
      );
    }

    const resumeText = await extractResumeText(file);
    const { profileJson, usage, model } = await extractProfile(resumeText);

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

    await writeLog(uid, {
      type: "resume_extract",
      status: "success",
      digest,
      model: model ?? usage?.model,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
    });

    return NextResponse.json({ ok: true, profileJson, digest });
  } catch (error) {
    if (error instanceof HttpError && error.message === "AI_NOT_CONFIGURED") {
      return handleError(error, digest);
    }
    await writeLog(uid, {
      type: "resume_extract",
      status: "error",
      digest,
      latencyMs: Date.now() - started,
      errorCode: error instanceof HttpError ? String(error.status) : "500",
      errorMessage: error instanceof Error ? error.message : "unknown",
      ipHash: hashIp(req),
    });
    return handleError(error, digest);
  }
}
