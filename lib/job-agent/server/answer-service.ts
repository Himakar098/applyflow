import "server-only";

import { createHash } from "node:crypto";

import { HttpError } from "@/lib/auth/verify-id-token";
import {
  proposeApplicationAnswer,
  validateGeneratedText,
} from "@/lib/job-agent";
import {
  getStoredApplication,
  type StoredApplicationAnswer,
} from "@/lib/job-agent/server/application-service";
import { recordAuditEvent } from "@/lib/job-agent/server/audit-service";
import { getCandidateProfile } from "@/lib/job-agent/server/profile-service";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  listRecords,
  userCollection,
  userDocument,
} from "@/lib/job-agent/server/store";

function answerId(applicationId: string, question: string) {
  const hash = createHash("sha256").update(question.trim().toLowerCase()).digest("hex").slice(0, 24);
  return `answer-${applicationId}-${hash}`;
}

export async function listApplicationAnswers(uid: string, applicationId: string) {
  await getStoredApplication(uid, applicationId);
  return listRecords<StoredApplicationAnswer>(
    userCollection(uid, JOB_AGENT_COLLECTIONS.answers)
      .where("applicationId", "==", applicationId)
      .orderBy("createdAt", "asc")
      .limit(100),
  );
}

export async function proposeApplicationAnswers(
  uid: string,
  applicationId: string,
  questions: string[],
) {
  const [{ application }, profile] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
  ]);
  if (application.eligibility === "ineligible") {
    throw new HttpError(409, "Answers cannot be generated for an ineligible application");
  }
  const now = new Date().toISOString();
  const answers: StoredApplicationAnswer[] = [];
  for (const question of questions) {
    const proposal = proposeApplicationAnswer(question, profile);
    const id = answerId(applicationId, question);
    const existing = await getRecord<StoredApplicationAnswer>(
      uid,
      JOB_AGENT_COLLECTIONS.answers,
      id,
    );
    const answer: StoredApplicationAnswer = {
      id,
      applicationId,
      question: proposal.question,
      classification: proposal.classification,
      proposedValue: proposal.proposedValue,
      proposedAnswer: proposal.proposedValue,
      sourceClaimIds: proposal.sourceClaimIds,
      confidence: proposal.confidence,
      requiresUserConfirmation: proposal.requiresUserConfirmation,
      requiresReview: proposal.requiresUserConfirmation,
      autoFillAllowed: proposal.autoFillAllowed,
      pauseReason: proposal.pauseReason,
      confirmed: existing?.confirmed === true
        && existing.proposedValue === proposal.proposedValue,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await userDocument(uid, JOB_AGENT_COLLECTIONS.answers, id).set(answer);
    answers.push(answer);
  }
  return answers;
}

const LOCKED_TRUTH_CLASSIFICATIONS = new Set([
  "citizenship",
  "permanent-residency",
  "visa",
  "work-rights",
  "security-clearance",
  "australian-driver-licence",
]);

export async function updateApplicationAnswers(
  uid: string,
  applicationId: string,
  updates: Array<{ id: string; proposedValue: string | null; confirmed: boolean }>,
) {
  const profile = await getCandidateProfile(uid);
  await getStoredApplication(uid, applicationId);
  const changed: StoredApplicationAnswer[] = [];
  for (const update of updates) {
    const current = await getRecord<StoredApplicationAnswer>(
      uid,
      JOB_AGENT_COLLECTIONS.answers,
      update.id,
    );
    if (!current || current.applicationId !== applicationId) {
      throw new HttpError(404, "Application answer not found");
    }

    if (LOCKED_TRUTH_CLASSIFICATIONS.has(current.classification)) {
      const canonical = proposeApplicationAnswer(current.question, profile);
      if (canonical.proposedValue !== update.proposedValue) {
        throw new HttpError(422, `The ${current.classification} answer contradicts the confirmed profile`);
      }
    }
    if (update.proposedValue) {
      const truthfulness = validateGeneratedText(update.proposedValue, profile);
      if (!truthfulness.valid) {
        throw new HttpError(422, "Application answer failed truthfulness checks");
      }
    }
    if (update.confirmed && !update.proposedValue) {
      throw new HttpError(422, "A blank answer cannot be confirmed");
    }

    const updated: StoredApplicationAnswer = {
      ...current,
      proposedValue: update.proposedValue,
      proposedAnswer: update.proposedValue,
      confirmed: update.confirmed,
      updatedAt: new Date().toISOString(),
    };
    await userDocument(uid, JOB_AGENT_COLLECTIONS.answers, update.id).set(updated);
    await recordAuditEvent(uid, {
      applicationId,
      type: "answer_changed",
      metadata: {
        answerId: update.id,
        classification: current.classification,
        confirmed: update.confirmed,
        summary: "Application answer reviewed",
      },
    });
    changed.push(updated);
  }
  return changed;
}

