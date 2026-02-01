import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }

  console.error("api/generations", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  const digest = randomUUID();

  try {
    const { uid } = await verifyIdToken(req);

    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("generations")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        jobTitle: data.jobTitle,
        company: data.company,
        jobDescription: data.jobDescription,
        output: data.output,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    return NextResponse.json({ ok: true, items, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
