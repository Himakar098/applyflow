import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { HttpError } from "@/lib/auth/verify-id-token";
import {
  structuredJobSchema,
  truthfulnessAssessmentSchema,
  validateGroundedStatements,
} from "@/lib/job-agent";
import { getStoredApplication } from "@/lib/job-agent/server/application-service";
import { recordAuditEvent } from "@/lib/job-agent/server/audit-service";
import {
  allGroundedFollowUpStatements,
  followUpMaterialsContentSchema,
  generateGroundedFollowUpMaterials,
} from "@/lib/job-agent/server/follow-up-materials";
import { getStoredJob } from "@/lib/job-agent/server/job-service";
import { getCandidateProfile } from "@/lib/job-agent/server/profile-service";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  userDocument,
} from "@/lib/job-agent/server/store";

export const storedFollowUpMaterialsSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  content: followUpMaterialsContentSchema,
  truthfulness: truthfulnessAssessmentSchema,
  inputSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type StoredFollowUpMaterials = z.infer<typeof storedFollowUpMaterialsSchema>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function inputSnapshotHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export async function getLatestFollowUpMaterials(uid: string, applicationId: string) {
  const current = await getStoredApplication(uid, applicationId);
  const stored = await getRecord<StoredFollowUpMaterials>(
    uid,
    JOB_AGENT_COLLECTIONS.followUpDrafts,
    applicationId,
  );
  if (!stored) return null;
  const parsed = storedFollowUpMaterialsSchema.parse(stored);
  const [profile, rawJob] = await Promise.all([
    getCandidateProfile(uid),
    getStoredJob(uid, current.application.jobId),
  ]);
  const job = structuredJobSchema.parse(rawJob);
  const currentHash = inputSnapshotHash({
    profile,
    job,
    application: current.application,
    tracking: current.tracking,
  });
  return { ...parsed, stale: parsed.inputSnapshotHash !== currentHash };
}

export async function generateFollowUpMaterials(uid: string, applicationId: string) {
  const [{ application, tracking }, profile] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
  ]);
  if (application.status !== "SUBMITTED") {
    throw new HttpError(409, "Follow-up drafts are available only after a confirmed submission");
  }
  if (!application.dateApplied) {
    throw new HttpError(409, "A confirmed application date is required for follow-up drafts");
  }

  const job = structuredJobSchema.parse(await getStoredJob(uid, application.jobId));
  let content;
  try {
    content = generateGroundedFollowUpMaterials({
      profile,
      job,
      application,
      tracking,
    });
  } catch (error) {
    throw new HttpError(
      422,
      error instanceof Error
        ? error.message
        : "Grounded follow-up materials could not be generated",
    );
  }

  const truthfulness = validateGroundedStatements(
    allGroundedFollowUpStatements(content),
    profile,
  );
  if (!truthfulness.valid) {
    throw new HttpError(422, "Follow-up drafts failed candidate-evidence validation");
  }

  const existing = await getRecord<StoredFollowUpMaterials>(
    uid,
    JOB_AGENT_COLLECTIONS.followUpDrafts,
    applicationId,
  );
  const now = new Date().toISOString();
  const record = storedFollowUpMaterialsSchema.parse({
    id: applicationId,
    applicationId,
    content,
    truthfulness,
    inputSnapshotHash: inputSnapshotHash({ profile, job, application, tracking }),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  await userDocument(
    uid,
    JOB_AGENT_COLLECTIONS.followUpDrafts,
    applicationId,
  ).set(record);
  await recordAuditEvent(uid, {
    applicationId,
    type: "documents_generated",
    metadata: {
      kind: "follow_up_and_interview_drafts",
      delivery: "draft_only",
      sent: false,
      summary: "Grounded follow-up and interview materials generated for user review",
    },
  });
  return record;
}
