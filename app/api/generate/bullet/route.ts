import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { rewriteBullet } from "@/lib/ai/openai";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { hashIp, writeLog } from "@/lib/services/ai-logger";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

type BulletAction = "tighten" | "add_metric" | "ats" | "leadership";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/generate/bullet", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  const started = Date.now();

  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);

    const action = body?.action as BulletAction | undefined;
    const bullet = body?.bullet?.toString();
    const jobKeywords = Array.isArray(body?.jobKeywords)
      ? (body.jobKeywords as unknown[]).map((k) => k?.toString() ?? "").filter(Boolean)
      : [];
    const profileJson = body?.profileJson;

    if (!action || !bullet) {
      throw new HttpError(400, "action and bullet are required");
    }
    if (!["tighten", "add_metric", "ats", "leadership"].includes(action)) {
      throw new HttpError(400, "Invalid action");
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

    const result = await rewriteBullet({
      action,
      bullet,
      jobKeywords,
      profileJson,
    });

    await writeLog(uid, {
      type: "bullet_rewrite",
      status: "success",
      digest,
      model: result.model ?? result.usage?.model ?? undefined,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      totalTokens: result.usage?.totalTokens,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
      meta: { action, keywordCount: jobKeywords.length },
    });

    return NextResponse.json({ ok: true, bullet: result.bullet, digest }, { status: 200 });
  } catch (error) {
    let uid = "unknown";
    try {
      uid = (await verifyIdToken(req)).uid;
    } catch {
      // ignore
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
