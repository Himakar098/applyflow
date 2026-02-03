import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }
  console.error("api/resumes/[resumeId]", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

function storagePathFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/o\/([^?]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ resumeId: string }> },
) {
  const digest = randomUUID();
  let uid = "unknown";

  try {
    uid = (await verifyIdToken(req)).uid;
    const { resumeId } = await context.params;
    if (!resumeId) throw new HttpError(400, "resumeId is required");

    const docRef = adminDb.collection("users").doc(uid).collection("resumes").doc(resumeId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Resume not found");
    }

    const data = snapshot.data() || {};
    const storagePath = data.storagePath || storagePathFromUrl(data.downloadUrl);
    const bucket = adminStorage.bucket();

    let storageError: string | null = null;
    let firestoreError: string | null = null;

    if (storagePath) {
      try {
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      } catch (error) {
        console.error("resume delete storage error", { digest, error });
        storageError = "STORAGE_DELETE_FAILED";
      }
    }

    try {
      await docRef.delete();
    } catch (error) {
      console.error("resume delete firestore error", { digest, error });
      firestoreError = "FIRESTORE_DELETE_FAILED";
    }

    if (storageError || firestoreError) {
      return NextResponse.json(
        {
          ok: false,
          error: "RESUME_DELETE_PARTIAL",
          digest,
          details: { storageError, firestoreError },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, digest }, { status: 200 });
  } catch (error) {
    return handleError(error, digest);
  }
}
