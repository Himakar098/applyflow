"use server";

import { adminDb } from "@/lib/firebase/admin";
import { recordUserAnalyticsEvent } from "@/lib/analytics/server";
import type { JobApplication, JobDraft } from "@/lib/types";
import { requireUserId } from "@/lib/services/server-auth";

function serializeJob(
  id: string,
  data: FirebaseFirestore.DocumentData,
): JobApplication {
  return {
    id,
    company: data.company,
    title: data.title,
    location: data.location,
    source: data.source,
    status: data.status,
    jobDescription: data.jobDescription,
    jobUrl: data.jobUrl,
    applicationUrl: data.applicationUrl,
    followUpDate: data.followUpDate,
    appliedDate: data.appliedDate,
    notes: data.notes,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    checklist: data.checklist,
  };
}

export async function fetchJobs(idToken: string | null): Promise<JobApplication[]> {
  const uid = await requireUserId(idToken);

  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("jobs")
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => serializeJob(doc.id, doc.data()));
}

export async function createJob(
  idToken: string | null,
  payload: JobDraft,
): Promise<JobApplication> {
  const uid = await requireUserId(idToken);
  const now = new Date().toISOString();

  const docRef = await adminDb
    .collection("users")
    .doc(uid)
    .collection("jobs")
    .add({
      ...payload,
      jobDescription: payload.jobDescription ?? "",
      jobUrl: payload.jobUrl ?? "",
      applicationUrl: payload.applicationUrl ?? "",
      followUpDate: payload.followUpDate ?? "",
      createdAt: now,
      updatedAt: now,
    });

  const snapshot = await docRef.get();
  if (payload.status === "applied") {
    await recordUserAnalyticsEvent(uid, "job_applied", { source: payload.source ?? "manual" });
  }
  return serializeJob(docRef.id, snapshot.data() || {});
}

export async function updateJob(
  idToken: string | null,
  jobId: string,
  payload: Partial<JobDraft>,
): Promise<JobApplication> {
  const uid = await requireUserId(idToken);
  const now = new Date().toISOString();

  const docRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("jobs")
    .doc(jobId);
  const beforeSnap = await docRef.get();
  const previousStatus = (beforeSnap.data()?.status ?? "").toString().toLowerCase();
  const nextStatus = (payload.status ?? previousStatus).toString().toLowerCase();

  const updateData: Record<string, unknown> = {
    ...payload,
    updatedAt: now,
  };
  if ("jobDescription" in payload) updateData.jobDescription = payload.jobDescription ?? "";
  if ("jobUrl" in payload) updateData.jobUrl = payload.jobUrl ?? "";
  if ("applicationUrl" in payload) updateData.applicationUrl = payload.applicationUrl ?? "";
  if ("followUpDate" in payload) updateData.followUpDate = payload.followUpDate ?? "";

  await docRef.update(updateData);

  const snapshot = await docRef.get();
  if (nextStatus === "applied" && previousStatus !== "applied") {
    await recordUserAnalyticsEvent(uid, "job_applied", { source: payload.source ?? "manual" });
  }
  return serializeJob(snapshot.id, snapshot.data() || {});
}

export async function deleteJob(idToken: string | null, jobId: string) {
  const uid = await requireUserId(idToken);

  await adminDb
    .collection("users")
    .doc(uid)
    .collection("jobs")
    .doc(jobId)
    .delete();

  return { success: true };
}
