import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
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

  console.error("api/resume/extract", digest, error);
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
    uid = (await verifyIdToken(req)).uid;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new HttpError(400, "File is required");
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

    const normalized = await extractResumeText(file);

    await writeLog(uid, {
      type: "resume_extract",
      status: "success",
      digest,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
      meta: { textLength: normalized.length },
    });

    return NextResponse.json(
      { ok: true, text: normalized, digest },
      { status: 200 },
    );
  } catch (error) {
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
