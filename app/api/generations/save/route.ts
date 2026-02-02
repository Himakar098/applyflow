import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type OutputShape = { resumeBullets: string[]; coverLetter: string };

function validateBody(body: unknown): {
  genId?: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  output: OutputShape;
  style?: string;
  tone?: string;
  focusKeywords?: string[];
  keywords?: string[];
} {
  const data = (body ?? {}) as Record<string, unknown>;
  const genId = (data.genId as string | undefined)?.toString().trim() || undefined;
  const jobTitle = (data.jobTitle as string | undefined)?.toString().trim();
  const company = (data.company as string | undefined)?.toString().trim();
  const jobDescription =
    (data.jobDescription as string | undefined)?.toString().trim() ?? "";
  const output = data.output as OutputShape | undefined;
  const style = (data.style as string | undefined)?.toString().trim();
  const tone = (data.tone as string | undefined)?.toString().trim();
  const focusKeywords = Array.isArray(data.focusKeywords)
    ? (data.focusKeywords as unknown[]).map((k) => k?.toString().trim() || "").filter(Boolean)
    : undefined;
  const keywords = Array.isArray(data.keywords)
    ? (data.keywords as unknown[]).map((k) => k?.toString().trim() || "").filter(Boolean)
    : undefined;

  if (!jobTitle || !company) {
    throw new HttpError(400, "jobTitle and company are required");
  }
  if (!output || !Array.isArray(output.resumeBullets) || !output.coverLetter) {
    throw new HttpError(
      400,
      "output.resumeBullets (array) and output.coverLetter are required",
    );
  }

  return { genId, jobTitle, company, jobDescription, output, style, tone, focusKeywords, keywords };
}

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/generations/save", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  const digest = crypto.randomUUID();

  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);
    const {
      genId,
      jobTitle,
      company,
      jobDescription,
      output,
      style,
      tone,
      focusKeywords,
      keywords,
    } =
      validateBody(body);

    const genRef = genId
      ? adminDb.collection("users").doc(uid).collection("generations").doc(genId)
      : adminDb.collection("users").doc(uid).collection("generations").doc();

    const snapshot = await genRef.get();
    const now = FieldValue.serverTimestamp();

    await genRef.set(
      {
        jobTitle,
        company,
        jobDescription,
        style,
        tone,
        focusKeywords,
        keywords,
        output,
        updatedAt: now,
        createdAt: snapshot.exists ? snapshot.data()?.createdAt ?? now : now,
      },
      { merge: true },
    );

    return NextResponse.json(
      { ok: true, id: genRef.id, digest },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest);
  }
}
