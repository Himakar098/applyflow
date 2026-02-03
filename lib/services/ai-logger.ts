import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

import { adminDb } from "@/lib/firebase/admin";

type LogPayload = {
  type: "tailored_pack" | "bullet_rewrite" | "resume_extract" | "jd_parse" | "other";
  status: "success" | "error" | "blocked";
  digest: string;
  model?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  ipHash?: string;
  meta?: Record<string, unknown>;
};

export function createLogRef(uid: string) {
  return adminDb.collection("users").doc(uid).collection("logs").doc();
}

export async function writeLog(uid: string, payload: LogPayload) {
  const docRef = payload.digest
    ? adminDb.collection("users").doc(uid).collection("logs").doc(payload.digest)
    : createLogRef(uid);

  await docRef.set(
    {
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export function hashIp(req: NextRequest): string | undefined {
  const reqWithIp = req as NextRequest & { ip?: string };
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqWithIp.ip ||
    undefined;
  if (!raw) return;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
