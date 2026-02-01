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

  console.error("api/jobs", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  const digest = crypto.randomUUID();

  try {
    const { uid } = await verifyIdToken(req);

    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("jobs")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        title: data.title,
        company: data.company,
        description:
          data.jobDescription ??
          data.description ??
          data.notes ??
          data.notesText ??
          "",
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
