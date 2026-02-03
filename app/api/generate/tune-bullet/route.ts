import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { tuneBullet } from "@/lib/ai/openai";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { hashIp, writeLog } from "@/lib/services/ai-logger";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/generate/tune-bullet", digest, error);
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
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "AI_NOT_CONFIGURED", digest },
        { status: 503 },
      );
    }
    const body = await req.json().catch(() => null);

    const bullet = body?.bullet?.toString();
    const mode = body?.mode?.toString();
    const profileJson = body?.profileJson;
    const jobDescription = body?.jobDescription?.toString() ?? "";

    if (!bullet || !mode || !profileJson) {
      throw new HttpError(400, "bullet, mode, and profileJson are required");
    }

    if (!["tighten", "metric", "ats", "leadership"].includes(mode)) {
      throw new HttpError(400, "Invalid mode");
    }

    const usageCheck = await checkAndIncrementUsage({
      uid,
      kind: "bullet_rewrite",
      increment: 1,
      adminDb,
    });

    if (!usageCheck.allowed) {
      await writeLog(uid, {
        type: "bullet_rewrite",
        status: "blocked",
        digest,
        errorCode: "DAILY_LIMIT_REACHED",
        errorMessage: usageCheck.limitType,
        latencyMs: Date.now() - started,
        ipHash: hashIp(req),
        meta: { limitType: usageCheck.limitType, dateKey: usageCheck.dateKey },
      });
      return NextResponse.json(
        { ok: false, error: "DAILY_LIMIT_REACHED", limitType: usageCheck.limitType, digest },
        { status: 429 },
      );
    }

    const refined = await tuneBullet({
      bullet,
      mode: mode as "tighten" | "metric" | "ats" | "leadership",
      profileJson,
      jobDescription,
    });

    await writeLog(uid, {
      type: "bullet_rewrite",
      status: "success",
      digest,
      model: refined.usage?.model ?? undefined,
      promptTokens: refined.usage?.promptTokens,
      completionTokens: refined.usage?.completionTokens,
      totalTokens: refined.usage?.totalTokens,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
      meta: { mode },
    });

    return NextResponse.json({ ok: true, bullet: refined.bullet, digest }, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError && error.message === "AI_NOT_CONFIGURED") {
      return handleError(error, digest);
    }
    await writeLog(uid, {
      type: "bullet_rewrite",
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
