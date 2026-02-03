import { NextRequest, NextResponse } from "next/server";

import { verifyIdToken } from "@/lib/auth/verify-id-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await verifyIdToken(req);
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({ ok: true, enabled }, { status: 200 });
}
