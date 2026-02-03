import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { refineParsedJD } from "@/lib/ai/jd-parse";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { heuristicParseJD } from "@/lib/jobs/jd-parse";
import { hashIp, writeLog } from "@/lib/services/ai-logger";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/jobs/parse", digest, error);
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
    const body = await req.json().catch(() => null);
    const jobText = body?.jobText?.toString() ?? "";

    if (!jobText) throw new HttpError(400, "jobText is required");
    if (jobText.length > 12000) throw new HttpError(400, "jobText too long (max 12000 chars)");

    const usageCheck = await checkAndIncrementUsage({
      uid,
      kind: "jd_parse",
      increment: 1,
      adminDb,
    });
    if (!usageCheck.allowed) {
      await writeLog(uid, {
        type: "jd_parse",
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

    const heuristic = heuristicParseJD(jobText);
    let parsed = heuristic;
    try {
      parsed = await refineParsedJD({ jobText, heuristic });
    } catch {
      parsed = heuristic;
    }

    await writeLog(uid, {
      type: "jd_parse",
      status: "success",
      digest,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
      meta: {
        jdLength: jobText.length,
        keywords: parsed.keywords.length,
        techStack: parsed.techStack.length,
      },
    });

    return NextResponse.json(
      { ok: true, ...parsed, digest },
      { status: 200 },
    );
  } catch (error) {
    await writeLog(uid, {
      type: "jd_parse",
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
