import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getBetaModeConsistency } from "@/lib/beta/server";
import { adminDb } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/monitoring/capture-server-error";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const digest = randomUUID();

  try {
    const deepCheck = req.nextUrl.searchParams.get("deep") === "1";
    const healthcheckSecret = process.env.HEALTHCHECK_SECRET;

    if (deepCheck && healthcheckSecret) {
      const providedSecret = req.headers.get("x-healthcheck-secret");
      if (providedSecret !== healthcheckSecret) {
        return NextResponse.json(
          { ok: false, error: "forbidden", digest },
          { status: 403 },
        );
      }
    }

    let firestore = "skipped";
    let firestoreData: Record<string, unknown> = {};
    const envChecks = {
      siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      supportEmail: Boolean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
      sentryServer: Boolean(process.env.SENTRY_DSN),
      sentryClient: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      firebaseAdmin: Boolean(
        process.env.FIREBASE_ADMIN_CREDENTIAL ||
          process.env.FIREBASE_ADMIN_CREDENTIALS ||
          (process.env.FIREBASE_PROJECT_ID &&
            process.env.FIREBASE_CLIENT_EMAIL &&
            process.env.FIREBASE_PRIVATE_KEY),
      ),
    };
    const betaConsistency = getBetaModeConsistency();

    if (deepCheck) {
      const snap = await adminDb.collection("system").doc("health").get();
      firestore = "ok";
      firestoreData = (snap.data() as Record<string, unknown> | undefined) ?? {};
    }

    return NextResponse.json(
      {
        ok: true,
        digest,
        timestamp: new Date().toISOString(),
        service: "applyflow",
        firestore,
        data: firestoreData,
        checks: {
          env: envChecks,
          betaMode: betaConsistency,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    captureServerError(error, { route: "api/health", digest });
    console.error("api/health", { digest, message });
    return NextResponse.json(
      { ok: false, digest, error: "internal_error" },
      { status: 500 },
    );
  }
}
