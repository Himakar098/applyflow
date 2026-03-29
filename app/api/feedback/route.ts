import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/monitoring/capture-server-error";

export const runtime = "nodejs";

const TYPES = new Set(["bug", "idea", "question"]);

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  captureServerError(error, { route: "api/feedback", digest });
  console.error("api/feedback", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    const { uid, decoded } = await verifyIdToken(req);
    const body = (await req.json().catch(() => null)) as
      | { type?: string; message?: string; page?: string; priority?: string }
      | null;

    const type = (body?.type ?? "").trim().toLowerCase();
    const message = (body?.message ?? "").trim();
    const page = (body?.page ?? "").trim();
    const priority = (body?.priority ?? "normal").trim().toLowerCase();

    if (!TYPES.has(type)) throw new HttpError(400, "invalid_type");
    if (message.length < 10) throw new HttpError(400, "message_too_short");
    if (message.length > 2000) throw new HttpError(400, "message_too_long");

    const entry = {
      uid,
      email: decoded?.email ?? "",
      type,
      message,
      page: page || null,
      priority,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    };

    await adminDb.collection("users").doc(uid).collection("feedback").add(entry);
    await adminDb.collection("support").doc("feedback").collection("items").add(entry);

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
