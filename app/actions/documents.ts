"use server";

import { adminDb } from "@/lib/firebase/admin";
import type { DocumentRecord } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";

const serializeDocument = (
  id: string,
  data: FirebaseFirestore.DocumentData,
): DocumentRecord => ({
  id,
  fileName: data.fileName,
  downloadUrl: data.downloadUrl,
  type: data.type,
  uploadedAt: data.uploadedAt,
});

export async function fetchDocuments(idToken: string | null): Promise<DocumentRecord[]> {
  const uid = await requireUserId(idToken);

  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("documents")
    .orderBy("uploadedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => serializeDocument(doc.id, doc.data()));
}

export async function saveDocumentRecord(
  idToken: string | null,
  payload: Omit<DocumentRecord, "id">,
): Promise<DocumentRecord> {
  const uid = await requireUserId(idToken);
  const docRef = await adminDb
    .collection("users")
    .doc(uid)
    .collection("documents")
    .add(payload);

  const snapshot = await docRef.get();
  return serializeDocument(snapshot.id, snapshot.data() || {});
}
