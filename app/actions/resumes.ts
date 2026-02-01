"use server";

import { adminDb } from "@/lib/firebase/admin";
import type { ResumeRecord } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";

const serializeResume = (
  id: string,
  data: FirebaseFirestore.DocumentData,
): ResumeRecord => ({
  id,
  fileName: data.fileName,
  downloadUrl: data.downloadUrl,
  status: data.status,
  uploadedAt: data.uploadedAt,
  parsedText: data.parsedText,
});

export async function fetchResumes(
  idToken: string | null,
): Promise<ResumeRecord[]> {
  const uid = await requireUserId(idToken);

  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("resumes")
    .orderBy("uploadedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => serializeResume(doc.id, doc.data()));
}

export async function saveResumeRecord(
  idToken: string | null,
  payload: Omit<ResumeRecord, "id">,
): Promise<ResumeRecord> {
  const uid = await requireUserId(idToken);
  const docRef = await adminDb
    .collection("users")
    .doc(uid)
    .collection("resumes")
    .add(payload);

  const snapshot = await docRef.get();
  return serializeResume(snapshot.id, snapshot.data() || {});
}
