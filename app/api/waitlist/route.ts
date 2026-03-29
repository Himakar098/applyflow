import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  captureServerError(error, { route: "api/waitlist", digest });
  console.error("api/waitlist", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  const ip = getClientIp(req);

  try {
    const byIp = checkRateLimit({
      key: `waitlist:ip:${ip}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (!byIp.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", digest, retryAfterSec: byIp.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(byIp.retryAfterSec) } },
      );
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const fullName = String(body?.fullName ?? "").trim();
    const source = String(body?.source ?? "public_beta").trim();
    const notes = String(body?.notes ?? "").trim();
    const website = String(body?.website ?? "").trim();

    if (website) {
      return NextResponse.json({ ok: true, digest }, { status: 200 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "valid_email_required", digest }, { status: 400 });
    }

    const byEmail = checkRateLimit({
      key: `waitlist:email:${email}`,
      limit: 3,
      windowMs: 10 * 60 * 1000,
    });
    if (!byEmail.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", digest, retryAfterSec: byEmail.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(byEmail.retryAfterSec) } },
      );
    }

    await adminDb.collection("marketing").doc("waitlist").collection("items").add({
      email,
      fullName,
      source,
      notes,
      createdAt: FieldValue.serverTimestamp(),
      status: "new",
    });

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
