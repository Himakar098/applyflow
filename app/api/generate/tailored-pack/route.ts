import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { generateTailoredPack } from "@/lib/ai/openai";
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

  console.error("api/generate/tailored-pack", digest, error);
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

    const jobTitle = body?.jobTitle?.toString().trim();
    const company = body?.company?.toString().trim();
    const jobDescription = body?.jobDescription?.toString().trim();
    const styleInput = body?.style?.toString().trim().toLowerCase();
    const toneInput = body?.tone?.toString().trim().toLowerCase();
    const focusKeywordsInput = Array.isArray(body?.focusKeywords)
      ? (body.focusKeywords as unknown[])
      : [];
    const jobId = body?.jobId?.toString().trim();

    const style = ["ats", "impact", "leadership", "entry"].includes(
      styleInput ?? "",
    )
      ? styleInput
      : "ats";
    const tone = ["formal", "friendly", "direct"].includes(toneInput ?? "")
      ? toneInput
      : "formal";
    const focusKeywords = focusKeywordsInput
      .map((k) => (typeof k === "string" ? k : String(k || "")))
      .map((k) => k.slice(0, 40).trim())
      .filter(Boolean)
      .slice(0, 30);

    if (!jobTitle || !company || !jobDescription) {
      throw new HttpError(400, "jobTitle, company, and jobDescription are required");
    }

    const usageCheck = await checkAndIncrementUsage({
      uid,
      kind: "tailored_pack",
      increment: 1,
      adminDb,
    });

    if (!usageCheck.allowed) {
      await writeLog(uid, {
        type: "tailored_pack",
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
      throw new HttpError(400, "Profile not found. Build your profile in Settings or upload a resume.");
    }

    const { pack, keywords, usage, model } = await generateTailoredPack({
      profileJson: profileData.profileJson,
      jobTitle,
      company,
      jobDescription,
      style: style as "ats" | "impact" | "leadership" | "entry",
      tone: tone as "formal" | "friendly" | "direct",
      focusKeywords,
    });

    const genRef = adminDb.collection("users").doc(uid).collection("generations").doc();
    await genRef.set({
      jobTitle,
      company,
      jobDescription,
      jobId: jobId || null,
      style,
      tone,
      focusKeywords,
      keywords,
      output: pack,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeLog(uid, {
      type: "tailored_pack",
      status: "success",
      digest,
      model: model ?? usage?.model,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      latencyMs: Date.now() - started,
      ipHash: hashIp(req),
      meta: {
        jobTitleLength: jobTitle.length,
        jdLength: jobDescription.length,
        style,
        tone,
        jobId: jobId || null,
      },
    });

    return NextResponse.json(
      { ok: true, id: genRef.id, output: pack, keywords, style, tone, digest },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof HttpError && error.message === "AI_NOT_CONFIGURED") {
      return handleError(error, digest);
    }
    await writeLog(uid, {
      type: "tailored_pack",
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
