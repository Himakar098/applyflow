import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getBetaModeConsistency, getServerBetaAccessMode, isInviteCodeValid } from "@/lib/beta/server";
import { adminAuth } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
});

function tooManyRequests(digest: string, retryAfterSec: number) {
  return NextResponse.json(
    { ok: false, error: "rate_limited", digest, retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  const ip = getClientIp(req);

  try {
    const byIp = checkRateLimit({
      key: `register:ip:${ip}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!byIp.ok) return tooManyRequests(digest, byIp.retryAfterSec);

    const betaMode = getBetaModeConsistency();
    if (!betaMode.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "beta_mode_mismatch",
          digest,
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_payload", digest }, { status: 400 });
    }

    const { fullName, email, password, inviteCode } = parsed.data;

    const byEmail = checkRateLimit({
      key: `register:email:${email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!byEmail.ok) return tooManyRequests(digest, byEmail.retryAfterSec);

    const mode = getServerBetaAccessMode();
    if (mode === "waitlist") {
      return NextResponse.json({ ok: false, error: "waitlist_only", digest }, { status: 403 });
    }

    if (mode === "invite") {
      const code = inviteCode?.trim() ?? "";
      if (!code || !isInviteCodeValid(code)) {
        return NextResponse.json({ ok: false, error: "invalid_invite_code", digest }, { status: 403 });
      }
    }

    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ ok: false, error: "email_in_use", digest }, { status: 409 });
    } catch (error) {
      const authError = error as { code?: string };
      if (authError.code !== "auth/user-not-found") throw error;
    }

    const user = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false,
      disabled: false,
    });

    // Setting a baseline claim gives us a future server-side hook for strict beta gating.
    await adminAuth.setCustomUserClaims(user.uid, { betaApproved: true });
    const customToken = await adminAuth.createCustomToken(user.uid, {
      betaApproved: true,
    });

    return NextResponse.json({ ok: true, customToken, digest }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "api/auth/register", digest });
    console.error("api/auth/register", digest, error);
    return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
  }
}
