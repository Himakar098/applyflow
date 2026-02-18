import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { getUtcDateKey } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  console.error("api/recommendations/save", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid } = await verifyIdToken(req);
    const body = await req.json().catch(() => null);
    const job = body?.job;
    if (!job) throw new HttpError(400, "job is required");

    const title = job.title?.toString().trim();
    const company = job.company?.toString().trim();
    const description = job.description?.toString().trim() ?? "";
    const recId = job.id?.toString().trim();
    const requestedStatus = body?.status?.toString().trim().toLowerCase();
    const status = requestedStatus === "applied" ? "applied" : "saved";
    const hideAfterSave = Boolean(body?.hideAfterSave);
    if (!title || !company) throw new HttpError(400, "title and company are required");

    const now = new Date().toISOString();
    const jobRef = adminDb.collection("users").doc(uid).collection("jobs").doc();
    await jobRef.set({
      title,
      company,
      location: job.location ?? "",
      source: job.source ?? "external",
      status,
      appliedDate: status === "applied" ? now : "",
      jobDescription: description,
      jobUrl: job.url ?? job.sourceUrl ?? "",
      createdAt: now,
      updatedAt: now,
    });

    const dateKey = getUtcDateKey();
    const recRef = adminDb.collection("users").doc(uid).collection("recommendations").doc(dateKey);
    await recRef.set(
      {
        savedIds: FieldValue.arrayUnion(recId ?? jobRef.id),
      },
      { merge: true },
    );
    if (recId) {
      await recRef.set(
        {
          savedMap: {
            [recId]: jobRef.id,
          },
        },
        { merge: true },
      );
    }
    if (hideAfterSave && recId) {
      await recRef.set(
        {
          hiddenIds: FieldValue.arrayUnion(recId),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true, id: jobRef.id, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
