import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
  const digest = randomUUID();

  try {
    const ref = adminDb.collection("system").doc("health");
    await ref.set(
      {
        lastCheck: FieldValue.serverTimestamp(),
        ok: true,
      },
      { merge: true },
    );
    const snap = await ref.get();

    return NextResponse.json(
      { ok: true, data: snap.data() ?? {}, digest },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("api/health", { digest, message });
    return NextResponse.json(
      { ok: false, digest, error: "internal_error" },
      { status: 500 },
    );
  }
}
