import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { resolveApplyUrl } from "@/lib/apply-assistant/resolve-apply-url";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ ok: false, error: error.message, digest }, { status: error.status });
  }
  captureServerError(error, { route: "api/apply-assistant/resolve", digest });
  console.error("api/apply-assistant/resolve", digest, error);
  return NextResponse.json({ ok: false, error: "internal_error", digest }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  try {
    await verifyIdToken(req);
    const body = (await req.json().catch(() => null)) as
      | {
          title?: string;
          company?: string;
          location?: string;
          sourceUrl?: string;
        }
      | null;

    const title = body?.title?.toString().trim() ?? "";
    const company = body?.company?.toString().trim() ?? "";
    const location = body?.location?.toString().trim() ?? "";
    const sourceUrl = body?.sourceUrl?.toString().trim() ?? "";

    if (!title || !company) {
      throw new HttpError(400, "title and company are required");
    }

    const result = await resolveApplyUrl({
      title,
      company,
      location,
      sourceUrl,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
        digest,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest);
  }
}
