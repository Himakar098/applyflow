import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getBetaModeConsistency, getServerBetaAccessMode, isInviteCodeValid } from "@/lib/beta/server";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  const ip = getClientIp(req);

  try {
    const rate = checkRateLimit({
      key: `invite:validate:${ip}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", digest, retryAfterSec: rate.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const betaMode = getBetaModeConsistency();
    if (!betaMode.ok) {
      return NextResponse.json(
        { ok: false, error: "beta_mode_mismatch", digest },
        { status: 500 },
      );
    }

    const mode = getServerBetaAccessMode();
    if (mode !== "invite") {
      return NextResponse.json({ ok: true, digest }, { status: 200 });
    }

    const body = await req.json().catch(() => null);
    const inviteCode = String(body?.inviteCode ?? "").trim();
    if (!inviteCode || !isInviteCodeValid(inviteCode)) {
      return NextResponse.json({ ok: false, error: "invalid_invite_code", digest }, { status: 403 });
    }

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "api/beta/validate-invite", digest });
    console.error("api/beta/validate-invite", digest, error);
    return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
  }
}
