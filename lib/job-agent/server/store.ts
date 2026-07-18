import "server-only";

import type {
  DocumentData,
  DocumentReference,
  Query,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";

export const JOB_AGENT_COLLECTIONS = {
  profile: "jobAgentProfile",
  jobs: "jobAgentJobs",
  assessments: "jobAssessments",
  applications: "applications",
  applicationLocks: "applicationLocks",
  answers: "applicationAnswers",
  documents: "applicationDocuments",
  followUpDrafts: "followUpDrafts",
  approvals: "approvals",
  browserSessions: "browserSessions",
  audit: "auditEvents",
} as const;

export type JobAgentCollectionName =
  (typeof JOB_AGENT_COLLECTIONS)[keyof typeof JOB_AGENT_COLLECTIONS];

export function userRoot(uid: string) {
  return adminDb.collection("users").doc(uid);
}

export function userCollection(uid: string, name: JobAgentCollectionName) {
  return userRoot(uid).collection(name);
}

export function userDocument(
  uid: string,
  name: JobAgentCollectionName,
  id: string,
): DocumentReference<DocumentData> {
  return userCollection(uid, name).doc(id);
}

export async function getRecord<T>(
  uid: string,
  collection: JobAgentCollectionName,
  id: string,
): Promise<T | null> {
  const snapshot = await userDocument(uid, collection, id).get();
  return snapshot.exists ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
}

export async function listRecords<T>(query: Query<DocumentData>): Promise<T[]> {
  const snapshot = await query.get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }) as T);
}
