import "server-only";

import { createHash } from "node:crypto";

import { HttpError } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import {
  applicationSchema,
  approvalSchema,
  approveApplicationForAutofill,
  attachAutofillPlan,
  autofillPlanSchema,
  consumeSubmissionApproval,
  createJobFingerprint,
  candidateProfileSchema,
  detectDuplicateApplication,
  grantSubmissionApproval,
  hashAutofillPlan,
  himakarCandidateProfile,
  markApplicationReadyToSubmit,
  pauseAutofill,
  recordSuccessfulSubmission,
  resumeAutofill,
  revokeSubmissionApproval,
  startApprovedAutofill,
  transitionApplication,
  validateGroundedStatements,
  type Application,
  type ApplicationState,
  type Approval,
  type AutofillPlan,
} from "@/lib/job-agent";
import {
  bridgeAutofillPlanSchema,
  normalizeAutofillPlan,
  type AcceptedAutofillPlan,
  type BridgeAutofillPlan,
} from "@/lib/job-agent/server/bridge-plan";
import { recordAuditEvent } from "@/lib/job-agent/server/audit-service";
import {
  allGroundedStatements,
  groundedApplicationContentSchema,
} from "@/lib/job-agent/server/generated-documents";
import {
  assessmentView,
  getStoredAssessment,
  getStoredJob,
  jobView,
} from "@/lib/job-agent/server/job-service";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  listRecords,
  userCollection,
  userDocument,
} from "@/lib/job-agent/server/store";
import {
  createSubmissionAttempt,
  consumeSubmissionResult,
  submissionAttemptSchema,
  submissionAttemptView,
  type ManualSubmissionResolution,
  type SubmissionAttempt,
  type SubmissionResultInput,
} from "@/lib/job-agent/server/submission-receipts";
import {
  decryptJson,
  encryptJson,
  isEncryptionConfigured,
} from "@/lib/security/encryption";

type StoredApplication = Application & {
  /** Legacy plaintext fields are read only to migrate them on the next access. */
  autofillPlan?: AutofillPlan | null;
  bridgeAutofillPlan?: BridgeAutofillPlan | null;
  encryptedAutofillPlan?: string | null;
  encryptedBridgeAutofillPlan?: string | null;
  submissionAttempt?: SubmissionAttempt | null;
  tracking?: ApplicationTracking;
};

type ApprovalBinding = {
  profileRevision: string;
  profileHash: string;
  documents: Array<{ id: string; contentHash: string }>;
  answers: Array<{ id: string; contentHash: string }>;
};

type StoredApproval = Approval & {
  binding?: ApprovalBinding;
};

export type ApplicationTracking = {
  contactPerson: string | null;
  followUpDate: string | null;
  notes: string | null;
  outcome: string | null;
  resumeUsed: string | null;
  coverLetterUsed: string | null;
  interviewStages: Array<{
    id: string;
    stage: string;
    status: "planned" | "scheduled" | "completed" | "cancelled";
    scheduledAt?: string | null;
    notes?: string | null;
  }>;
};

const EMPTY_TRACKING: ApplicationTracking = {
  contactPerson: null,
  followUpDate: null,
  notes: null,
  outcome: null,
  resumeUsed: null,
  coverLetterUsed: null,
  interviewStages: [],
};

export type StoredApplicationAnswer = {
  id: string;
  applicationId: string;
  question: string;
  classification: string;
  proposedValue: string | null;
  proposedAnswer: string | null;
  sourceClaimIds: string[];
  confidence: number;
  requiresUserConfirmation: boolean;
  requiresReview: boolean;
  autoFillAllowed: boolean;
  pauseReason: string | null;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredApplicationDocument = {
  id: string;
  applicationId: string;
  type: "application_pack";
  content: unknown;
  provider: string;
  model: string;
  truthfulness: { valid: boolean; issues: unknown[] };
  /** Candidate evidence revision the generated/edited content is bound to. */
  profileRevision?: string;
  exports?: Record<string, string> | null;
  exportHashes?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
};

type BrowserSession = {
  id: string;
  applicationId: string;
  status: "REQUESTED" | "ACTIVE" | "PAUSED" | "READY_TO_SUBMIT" | "CLOSED";
  currentPage: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
};

function asDomainError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw new HttpError(409, error instanceof Error ? error.message : "Application action was rejected");
}

function approvalId(applicationId: string) {
  return `submission-${applicationId}`;
}

function lockId(company: string, role: string) {
  return createHash("sha256").update(createJobFingerprint(company, role)).digest("hex");
}

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

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function approvalBindingFor(input: {
  profile: ReturnType<typeof candidateProfileSchema.parse>;
  documents: StoredApplicationDocument[];
  answers: StoredApplicationAnswer[];
}): ApprovalBinding {
  return {
    profileRevision: input.profile.updatedAt,
    profileHash: contentHash(input.profile),
    documents: input.documents
      .map((document) => ({ id: document.id, contentHash: contentHash(document.content) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    answers: input.answers
      .map((answer) => ({
        id: answer.id,
        contentHash: contentHash({
          proposedValue: answer.proposedValue,
          proposedAnswer: answer.proposedAnswer,
          confirmed: answer.confirmed,
          sourceClaimIds: answer.sourceClaimIds,
        }),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function sameApprovalBinding(left: ApprovalBinding | undefined, right: ApprovalBinding) {
  return Boolean(left) && contentHash(left) === contentHash(right);
}

function encryptStoredPlans(
  plan: AutofillPlan | null,
  bridgePlan: BridgeAutofillPlan | null,
) {
  if ((plan || bridgePlan) && !isEncryptionConfigured()) {
    throw new HttpError(503, "ENCRYPTION_KEY is required before storing an autofill plan");
  }
  return {
    encryptedAutofillPlan: plan ? encryptJson(plan) : null,
    encryptedBridgeAutofillPlan: bridgePlan ? encryptJson(bridgePlan) : null,
    autofillPlan: null,
    bridgeAutofillPlan: null,
  };
}

function decryptStoredPlan<T>(payload: string, label: string): T {
  if (!isEncryptionConfigured()) {
    throw new HttpError(503, `ENCRYPTION_KEY is required before reading the ${label}`);
  }
  try {
    return decryptJson<T>(payload);
  } catch {
    throw new HttpError(500, `The encrypted ${label} could not be decrypted`);
  }
}

function parseStoredApplication(raw: StoredApplication) {
  const hasLegacyPlaintext = Boolean(raw.autofillPlan || raw.bridgeAutofillPlan);
  if (hasLegacyPlaintext && !isEncryptionConfigured()) {
    throw new HttpError(503, "ENCRYPTION_KEY is required to migrate a legacy autofill plan");
  }
  const rawPlan = raw.encryptedAutofillPlan
    ? decryptStoredPlan<AutofillPlan>(raw.encryptedAutofillPlan, "autofill plan")
    : raw.autofillPlan;
  const rawBridgePlan = raw.encryptedBridgeAutofillPlan
    ? decryptStoredPlan<BridgeAutofillPlan>(raw.encryptedBridgeAutofillPlan, "browser worker plan")
    : raw.bridgeAutofillPlan;
  return {
    application: applicationSchema.parse(raw),
    plan: rawPlan ? autofillPlanSchema.parse(rawPlan) : null,
    bridgePlan: rawBridgePlan ? bridgeAutofillPlanSchema.parse(rawBridgePlan) : null,
    submissionAttempt: raw.submissionAttempt
      ? submissionAttemptSchema.parse(raw.submissionAttempt)
      : null,
    tracking: { ...EMPTY_TRACKING, ...(raw.tracking ?? {}) },
    hasLegacyPlaintext,
  };
}

export async function getStoredApplication(uid: string, applicationId: string) {
  const raw = await getRecord<StoredApplication>(
    uid,
    JOB_AGENT_COLLECTIONS.applications,
    applicationId,
  );
  if (!raw) throw new HttpError(404, "Application not found");
  const parsed = parseStoredApplication(raw);
  if (parsed.hasLegacyPlaintext) {
    await userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId).set(
      encryptStoredPlans(parsed.plan, parsed.bridgePlan),
      { merge: true },
    );
  }
  return parsed;
}

export function applicationView(
  application: Application,
  tracking: ApplicationTracking = EMPTY_TRACKING,
) {
  return {
    ...application,
    title: application.role,
    ...tracking,
    tracking,
  };
}

export async function listApplications(
  uid: string,
  options: { status?: string; limit?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  let query = userCollection(uid, JOB_AGENT_COLLECTIONS.applications)
    .orderBy("updatedAt", "desc")
    .limit(limit);
  if (options.status) {
    query = userCollection(uid, JOB_AGENT_COLLECTIONS.applications)
      .where("status", "==", options.status)
      .orderBy("updatedAt", "desc")
      .limit(limit);
  }
  const records = await listRecords<StoredApplication>(query);
  return records.map((record) => applicationView(
    applicationSchema.parse(record),
    { ...EMPTY_TRACKING, ...(record.tracking ?? {}) },
  ));
}

export async function createApplication(uid: string, jobId: string) {
  const [jobRecord, assessmentRecord, existingRecords] = await Promise.all([
    getStoredJob(uid, jobId),
    getStoredAssessment(uid, jobId),
    listRecords<StoredApplication>(
      userCollection(uid, JOB_AGENT_COLLECTIONS.applications).limit(500),
    ),
  ]);
  if (!assessmentRecord) throw new HttpError(409, "Assess the job before creating an application");
  if (assessmentRecord.eligibility.decision === "ineligible") {
    throw new HttpError(409, "An ineligible job cannot become an application");
  }

  const job = jobRecord;
  const structured = jobView(jobRecord, assessmentRecord).structured;
  const existing = existingRecords.map((record) => applicationSchema.parse(record));
  const duplicate = detectDuplicateApplication(structured, existing);
  if (duplicate.duplicate) {
    throw new HttpError(409, `Duplicate application detected (${duplicate.reason})`);
  }

  const now = new Date().toISOString();
  const id = `application-${crypto.randomUUID()}`;
  const company = job.company.value ?? "Unknown company";
  const role = job.title.value ?? "Untitled role";
  const application = applicationSchema.parse({
    id,
    jobId,
    candidateProfileId: assessmentRecord.eligibility.candidateProfileId,
    company,
    role,
    source: job.sourceUrl.value ?? "manual import",
    jobUrl: job.sourceUrl.value,
    applicationUrl: job.applicationUrl.value,
    fitScore: assessmentRecord.fit.score,
    eligibility: assessmentRecord.eligibility.decision,
    status: "DRAFT",
    submissionMode: "review_before_submit",
    autofillPlanHash: null,
    dateDiscovered: job.createdAt,
    dateApplied: null,
    closingDate: job.closingDate.value,
    createdAt: now,
    updatedAt: now,
  });

  const applicationRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, id);
  const lockRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applicationLocks, lockId(company, role));
  await adminDb.runTransaction(async (transaction) => {
    const lock = await transaction.get(lockRef);
    if (lock.exists) {
      const existingId = lock.data()?.applicationId;
      if (typeof existingId === "string") {
        const existingRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, existingId);
        const existingSnapshot = await transaction.get(existingRef);
        if (existingSnapshot.exists && existingSnapshot.data()?.status !== "WITHDRAWN") {
          throw new HttpError(409, "A non-withdrawn application already exists for this company and role");
        }
      }
    }
    transaction.set(applicationRef, {
      ...application,
      autofillPlan: null,
      bridgeAutofillPlan: null,
      encryptedAutofillPlan: null,
      encryptedBridgeAutofillPlan: null,
      submissionAttempt: null,
      tracking: EMPTY_TRACKING,
    });
    transaction.set(lockRef, { applicationId: id, company, role, updatedAt: now });
  });

  await recordAuditEvent(uid, {
    applicationId: id,
    type: "job_captured",
    metadata: { jobId, summary: "Application record created from selected job" },
  });
  return applicationView(application);
}

async function relatedRecords(uid: string, applicationId: string) {
  const [documents, answers, approval, session] = await Promise.all([
    listRecords<StoredApplicationDocument>(
      userCollection(uid, JOB_AGENT_COLLECTIONS.documents)
        .where("applicationId", "==", applicationId)
        .orderBy("createdAt", "desc")
        .limit(50),
    ),
    listRecords<StoredApplicationAnswer>(
      userCollection(uid, JOB_AGENT_COLLECTIONS.answers)
        .where("applicationId", "==", applicationId)
        .orderBy("createdAt", "asc")
        .limit(100),
    ),
    getRecord<Approval>(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId)),
    getRecord<BrowserSession>(uid, JOB_AGENT_COLLECTIONS.browserSessions, applicationId),
  ]);
  return { documents, answers, approval, session };
}

function applicationDocumentView(document: StoredApplicationDocument) {
  const { exports, exportHashes: _exportHashes, profileRevision: _profileRevision, ...safe } = document;
  const allowedKinds = ["resumeDocx", "resumePdf", "coverLetterDocx", "coverLetterPdf"] as const;
  const availableKinds = allowedKinds.filter((kind) => Boolean(exports?.[kind]));
  return {
    ...safe,
    exports: availableKinds.length
      ? Object.fromEntries(availableKinds.map((kind) => [kind, kind]))
      : null,
    availableKinds,
  };
}

export async function readApplication(uid: string, applicationId: string) {
  const [{ application, plan, bridgePlan, submissionAttempt, tracking }, related] = await Promise.all([
    getStoredApplication(uid, applicationId),
    relatedRecords(uid, applicationId),
  ]);
  const [jobRecord, assessmentRecord] = await Promise.all([
    getStoredJob(uid, application.jobId),
    getStoredAssessment(uid, application.jobId),
  ]);
  const documents = related.documents.map(applicationDocumentView);
  const approval = related.approval ? approvalSchema.parse(related.approval) : null;
  return {
    application: {
      ...applicationView(application, tracking),
      documents,
      answers: related.answers,
      approvals: approval ? [approval] : [],
      browserSession: related.session,
    },
    job: jobView(jobRecord, assessmentRecord),
    assessment: assessmentRecord ? assessmentView(assessmentRecord) : null,
    documents,
    answers: related.answers,
    approval,
    browserSession: related.session,
    autofillPlan: plan ? {
      ...plan,
      fields: plan.fields.map((field) => ({
        ...field,
        proposedValue: field.sensitive || field.detectedFieldType === "file"
          ? "[REDACTED]"
          : field.proposedValue,
      })),
    } : null,
    workerPlan: bridgePlan ? {
      ...bridgePlan,
      mappings: bridgePlan.mappings.map((mapping) => ({
        ...mapping,
        proposedValue: mapping.field.sensitiveCategory === "none" && mapping.field.kind !== "file"
          ? mapping.proposedValue
          : "[REDACTED]",
      })),
    } : null,
    submissionAttempt: submissionAttemptView(submissionAttempt),
  };
}

export async function updateApplicationStatus(
  uid: string,
  applicationId: string,
  input: {
    status: ApplicationState;
    plan?: AcceptedAutofillPlan;
    planHash?: string;
    explicitUserApproval?: boolean;
    userInitiated?: boolean;
  },
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  let output: Application | null = null;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appRef);
      if (!snapshot.exists) throw new HttpError(404, "Application not found");
      const currentRaw = { id: snapshot.id, ...snapshot.data() } as StoredApplication;
      const parsed = parseStoredApplication(currentRaw);
      let current = parsed.application;
      let plan = parsed.plan;
      let bridgePlan = parsed.bridgePlan;
      let submissionAttempt = parsed.submissionAttempt;
      const now = new Date().toISOString();

      if (input.plan) {
        const normalized = normalizeAutofillPlan(input.plan);
        const validated = normalized.plan;
        if (validated.applicationId !== applicationId) {
          throw new HttpError(409, "Autofill plan belongs to a different application");
        }
        if (input.planHash && hashAutofillPlan(validated) !== input.planHash) {
          throw new HttpError(409, "Autofill plan hash does not match the supplied plan");
        }
        if (!plan || hashAutofillPlan(plan) !== hashAutofillPlan(validated)) {
          submissionAttempt = null;
        }
        current = attachAutofillPlan(current, validated, now);
        plan = validated;
        bridgePlan = normalized.bridgePlan;
      }

      let next: Application;
      if (input.status === "APPROVED_FOR_AUTOFILL") {
        next = approveApplicationForAutofill(current, input.explicitUserApproval === true, now);
      } else if (input.status === "AUTOFILL_IN_PROGRESS") {
        next = current.status === "AUTOFILL_PAUSED"
          ? resumeAutofill(current, input.userInitiated === true, now)
          : startApprovedAutofill(current, input.userInitiated === true, now);
      } else if (input.status === "AUTOFILL_PAUSED") {
        next = pauseAutofill(current, now);
      } else if (input.status === "READY_TO_SUBMIT") {
        if (!plan) throw new HttpError(409, "A reviewed autofill plan is required");
        next = markApplicationReadyToSubmit(current, plan, now);
      } else if (input.status === "SUBMISSION_APPROVED" || input.status === "SUBMITTED") {
        throw new HttpError(409, "Use the dedicated approval and submission-result endpoints");
      } else {
        next = transitionApplication(current, input.status, { now });
      }

      transaction.set(appRef, {
        ...next,
        ...encryptStoredPlans(plan, bridgePlan),
        submissionAttempt,
      }, { merge: true });
      output = next;
    });
  } catch (error) {
    asDomainError(error);
  }

  if (!output) throw new HttpError(500, "Application status was not updated");
  const updated = output as Application;
  return applicationView(updated);
}

async function updateBrowserSession(
  uid: string,
  applicationId: string,
  status: BrowserSession["status"],
  message: string,
  currentPage?: string | null,
) {
  const now = new Date().toISOString();
  const ref = userDocument(uid, JOB_AGENT_COLLECTIONS.browserSessions, applicationId);
  const existing = await getRecord<BrowserSession>(
    uid,
    JOB_AGENT_COLLECTIONS.browserSessions,
    applicationId,
  );
  const session: BrowserSession = {
    id: applicationId,
    applicationId,
    status,
    currentPage: currentPage === undefined ? existing?.currentPage ?? null : currentPage,
    message,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await ref.set(session);
  return session;
}

async function saveAutofillPlan(
  uid: string,
  applicationId: string,
  planInput: AcceptedAutofillPlan,
  approvals: { approvedFieldIds?: string[]; reviewedFieldIds?: string[] } = {},
) {
  const normalized = normalizeAutofillPlan(planInput, approvals);
  const plan = normalized.plan;
  if (plan.applicationId !== applicationId) {
    throw new HttpError(409, "Autofill plan belongs to a different application");
  }
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  let application: Application | null = null;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appRef);
      if (!snapshot.exists) throw new HttpError(404, "Application not found");
      const current = parseStoredApplication({ id: snapshot.id, ...snapshot.data() } as StoredApplication);
      const planChanged = current.application.autofillPlanHash !== hashAutofillPlan(plan);
      const next = !planChanged
        ? current.application
        : attachAutofillPlan(current.application, plan, new Date().toISOString());
      transaction.set(appRef, {
        ...next,
        ...encryptStoredPlans(plan, normalized.bridgePlan),
        submissionAttempt: planChanged ? null : current.submissionAttempt,
      }, { merge: true });
      application = next;
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!application) throw new HttpError(500, "Autofill plan was not saved");
  return {
    application: applicationView(application),
    plan,
    workerPlan: normalized.bridgePlan,
    planHash: hashAutofillPlan(plan),
  };
}

async function approveStoredAutofillPlan(
  uid: string,
  applicationId: string,
  input: {
    expectedPlanHash: string;
    approvedFieldIds: string[];
    reviewedFieldIds?: string[];
  },
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  let output: {
    application: Application;
    plan: AutofillPlan;
    bridgePlan: BridgeAutofillPlan | null;
  } | null = null;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appRef);
      if (!snapshot.exists) throw new HttpError(404, "Application not found");
      const current = parseStoredApplication({ id: snapshot.id, ...snapshot.data() } as StoredApplication);
      if (!current.plan) throw new HttpError(409, "Prepare an autofill plan before approval");
      const currentHash = hashAutofillPlan(current.plan);
      if (
        currentHash !== input.expectedPlanHash
        || current.application.autofillPlanHash !== input.expectedPlanHash
      ) {
        throw new HttpError(409, "The autofill plan changed after it was reviewed");
      }

      if (!current.bridgePlan) {
        throw new HttpError(409, "A current browser inspection plan is required");
      }
      const knownFieldIds = new Set(current.bridgePlan.mappings.map((mapping) => mapping.field.id));
      const approvedFieldIds = new Set(input.approvedFieldIds);
      if (
        approvedFieldIds.size !== input.approvedFieldIds.length
        || input.approvedFieldIds.some((fieldId) => !knownFieldIds.has(fieldId))
        || (input.reviewedFieldIds ?? []).some((fieldId) =>
          !knownFieldIds.has(fieldId) || !approvedFieldIds.has(fieldId),
        )
      ) {
        throw new HttpError(409, "Approved field ids must exactly reference the current reviewed browser plan");
      }
      const baseline = normalizeAutofillPlan(current.bridgePlan);
      if (hashAutofillPlan(baseline.plan) !== input.expectedPlanHash) {
        throw new HttpError(409, "The reviewed plan does not match the stored plan");
      }
      const normalized = normalizeAutofillPlan(current.bridgePlan, {
        approvedFieldIds: input.approvedFieldIds,
        reviewedFieldIds: input.reviewedFieldIds,
      });
      const reviewedPlan = normalized.plan;
      const bridgePlan = normalized.bridgePlan;
      if (!bridgePlan) throw new HttpError(409, "A current browser inspection plan is required");
      const approvedPlan = autofillPlanSchema.parse({
        ...reviewedPlan,
        fields: reviewedPlan.fields.map((field) => ({
          ...field,
          // The console promises that only explicitly checked fields are
          // approved. Non-sensitive fields are not an exception to that
          // per-field selection; the separate Start action controls when the
          // worker may write the selected values.
          approved: field.approved,
        })),
      });
      const now = new Date().toISOString();
      const attached = hashAutofillPlan(approvedPlan) === currentHash
        ? current.application
        : attachAutofillPlan(current.application, approvedPlan, now);
      const application = approveApplicationForAutofill(attached, true, now);
      transaction.set(appRef, {
        ...application,
        ...encryptStoredPlans(approvedPlan, bridgePlan),
        submissionAttempt: null,
      }, { merge: true });
      output = { application, plan: approvedPlan, bridgePlan };
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Autofill plan was not approved");
  return output as {
    application: Application;
      plan: AutofillPlan;
      bridgePlan: BridgeAutofillPlan | null;
  };
}

export async function readAutofillState(
  uid: string,
  applicationId: string,
  options: { includeWorkerValues?: boolean } = {},
) {
  const [{ application, plan, bridgePlan }, session] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getRecord<BrowserSession>(uid, JOB_AGENT_COLLECTIONS.browserSessions, applicationId),
  ]);
  return {
    application: applicationView(application),
    plan: plan ? {
      ...plan,
      fields: plan.fields.map((field) => ({
        ...field,
        proposedValue: !options.includeWorkerValues && field.sensitive
          ? "[REDACTED]"
          : !options.includeWorkerValues && field.detectedFieldType === "file"
            ? "[LOCAL DOCUMENT SELECTED]"
            : field.proposedValue,
      })),
    } : null,
    workerPlan: bridgePlan ? {
      ...bridgePlan,
      mappings: bridgePlan.mappings.map((mapping) => ({
        ...mapping,
        proposedValue: !options.includeWorkerValues && (
          mapping.field.sensitiveCategory !== "none" || mapping.field.kind === "file"
        )
          ? "[REDACTED]"
          : mapping.proposedValue,
      })),
    } : null,
    planHash: plan ? hashAutofillPlan(plan) : null,
    session,
  };
}

export async function handleAutofillAction(
  uid: string,
  applicationId: string,
  input:
    | { action: "inspect" }
    | { action: "save_plan"; plan: AcceptedAutofillPlan }
    | {
        action: "approve_autofill";
        expectedPlanHash: string;
        approvedFieldIds: string[];
        reviewedFieldIds?: string[];
        explicitUserApproval: true;
      }
    | { action: "start"; userInitiated: true }
    | { action: "pause"; reason?: string }
    | { action: "resume"; userInitiated: true }
    | {
        action: "ready_to_submit";
        plan: BridgeAutofillPlan;
        approvedFieldIds: string[];
        reviewedFieldIds?: string[];
      },
) {
  if (input.action === "inspect") {
    const { application } = await getStoredApplication(uid, applicationId);
    if (!application.applicationUrl) {
      throw new HttpError(409, "The application has no employer portal URL");
    }
    const session = await updateBrowserSession(
      uid,
      applicationId,
      "REQUESTED",
      "Inspection requested. Start the visible local browser worker to inspect this portal.",
      application.applicationUrl,
    );
    await recordAuditEvent(uid, {
      applicationId,
      type: "browser_session_started",
      metadata: { mode: "visible-worker-request", summary: "Visible browser inspection requested" },
    });
    return { application: applicationView(application), plan: null, session };
  }

  if (input.action === "save_plan") {
    const saved = await saveAutofillPlan(uid, applicationId, input.plan);
    const session = await updateBrowserSession(
      uid,
      applicationId,
      "PAUSED",
      "Autofill plan saved for user review.",
    );
    return { ...saved, session };
  }

  if (input.action === "approve_autofill") {
    const approved = await approveStoredAutofillPlan(uid, applicationId, {
      expectedPlanHash: input.expectedPlanHash,
      approvedFieldIds: input.approvedFieldIds,
      reviewedFieldIds: input.reviewedFieldIds,
    });
    const session = await updateBrowserSession(
      uid,
      applicationId,
      "PAUSED",
      "Autofill is approved. The user must explicitly start the visible worker.",
    );
    return {
      application: applicationView(approved.application),
      plan: approved.plan,
      workerPlan: approved.bridgePlan,
      planHash: hashAutofillPlan(approved.plan),
      session,
    };
  }

  if (input.action === "start") {
    const application = await updateApplicationStatus(uid, applicationId, {
      status: "AUTOFILL_IN_PROGRESS",
      userInitiated: true,
    });
    const { plan } = await getStoredApplication(uid, applicationId);
    const session = await updateBrowserSession(uid, applicationId, "ACTIVE", "Visible autofill is in progress.");
    return { application, plan, session };
  }

  if (input.action === "pause") {
    const application = await updateApplicationStatus(uid, applicationId, {
      status: "AUTOFILL_PAUSED",
    });
    const { plan } = await getStoredApplication(uid, applicationId);
    const session = await updateBrowserSession(
      uid,
      applicationId,
      "PAUSED",
      input.reason ?? "Autofill paused for user review.",
    );
    return { application, plan, session };
  }

  if (input.action === "resume") {
    const application = await updateApplicationStatus(uid, applicationId, {
      status: "AUTOFILL_IN_PROGRESS",
      userInitiated: true,
    });
    const { plan } = await getStoredApplication(uid, applicationId);
    const session = await updateBrowserSession(uid, applicationId, "ACTIVE", "Visible autofill resumed.");
    return { application, plan, session };
  }

  const saved = await saveAutofillPlan(uid, applicationId, input.plan, {
    approvedFieldIds: input.approvedFieldIds,
    reviewedFieldIds: input.reviewedFieldIds,
  });
  const application = await updateApplicationStatus(uid, applicationId, {
    status: "READY_TO_SUBMIT",
    plan: saved.plan,
    planHash: saved.planHash,
  });
  const session = await updateBrowserSession(
    uid,
    applicationId,
    "READY_TO_SUBMIT",
    "Autofill stopped before the final employer Submit control.",
  );
  return {
    application,
    plan: saved.plan,
    workerPlan: saved.workerPlan,
    planHash: saved.planHash,
    session,
  };
}

export async function getSubmissionApproval(uid: string, applicationId: string) {
  await getStoredApplication(uid, applicationId);
  const approval = await getRecord<Approval>(
    uid,
    JOB_AGENT_COLLECTIONS.approvals,
    approvalId(applicationId),
  );
  return approval ? approvalSchema.parse(approval) : null;
}

export async function grantFinalSubmissionApproval(
  uid: string,
  applicationId: string,
  expectedPlanHash: string,
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const approvalRef = userDocument(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId));
  const documentsQuery = userCollection(uid, JOB_AGENT_COLLECTIONS.documents)
    .where("applicationId", "==", applicationId);
  const answersQuery = userCollection(uid, JOB_AGENT_COLLECTIONS.answers)
    .where("applicationId", "==", applicationId);
  const profileRef = userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current");
  let output: { application: Application; approval: Approval } | null = null;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const [
        applicationSnapshot,
        approvalSnapshot,
        documentsSnapshot,
        answersSnapshot,
        profileSnapshot,
      ] = await Promise.all([
        transaction.get(appRef),
        transaction.get(approvalRef),
        transaction.get(documentsQuery),
        transaction.get(answersQuery),
        transaction.get(profileRef),
      ]);
      if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
      const { application, plan, bridgePlan } = parseStoredApplication({
        id: applicationSnapshot.id,
        ...applicationSnapshot.data(),
      } as StoredApplication);
      if (application.eligibility === "ineligible") {
        throw new HttpError(409, "Ineligible applications cannot be approved for submission");
      }
      if (!plan) throw new HttpError(409, "A reviewed autofill plan is required");
      const actualPlanHash = hashAutofillPlan(plan);
      if (actualPlanHash !== expectedPlanHash || application.autofillPlanHash !== expectedPlanHash) {
        throw new HttpError(409, "The approved autofill plan has changed");
      }
      if (approvalSnapshot.exists && approvalSnapshot.data()?.status === "granted") {
        throw new HttpError(409, "A final submission approval is already active");
      }

      const documents = documentsSnapshot.docs.map((document) => document.data() as StoredApplicationDocument);
      const profile = profileSnapshot.exists
        ? candidateProfileSchema.parse(profileSnapshot.data()?.profile)
        : himakarCandidateProfile;
      if (!documents.length) {
        throw new HttpError(409, "Truthful application documents must be generated before final approval");
      }
      for (const document of documents) {
        const content = groundedApplicationContentSchema.parse(document.content);
        const currentTruthfulness = validateGroundedStatements(
          allGroundedStatements(content),
          profile,
        );
        if (!currentTruthfulness.valid) {
          throw new HttpError(409, "Application documents no longer match the current candidate evidence");
        }
      }
      const answers = answersSnapshot.docs.map((document) => document.data() as StoredApplicationAnswer);
      if (answers.some((answer) => answer.requiresUserConfirmation && !answer.confirmed)) {
        throw new HttpError(409, "All review-required application answers must be confirmed");
      }

      const now = new Date();
      const granted = grantSubmissionApproval({
        approvalId: approvalId(applicationId),
        application,
        plan,
        explicitUserApproval: true,
        grantedBy: uid,
        grantedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
      });
      const binding = approvalBindingFor({ profile, documents, answers });
      transaction.set(approvalRef, { ...granted.approval, binding });
      transaction.set(appRef, {
        ...granted.application,
        ...encryptStoredPlans(plan, bridgePlan),
        submissionAttempt: null,
      }, { merge: true });
      output = granted;
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Final submission approval was not granted");
  const granted = output as { application: Application; approval: Approval };
  await recordAuditEvent(uid, {
    applicationId,
    type: "user_approval_granted",
    metadata: {
      action: "final_submission",
      planHash: granted.approval.planHash,
      expiresAt: granted.approval.expiresAt,
      summary: "Final submission approval granted",
    },
  });
  return {
    application: applicationView(granted.application),
    approval: granted.approval,
  };
}

/**
 * Called by the visible browser worker immediately before it presses the
 * employer's final Submit control. This consumes the approval but deliberately
 * leaves the application at SUBMISSION_APPROVED until the portal reports a
 * successful result through the dedicated worker result endpoint.
 */
export async function consumeFinalSubmissionApproval(
  uid: string,
  applicationId: string,
  expectedPlanHash: string,
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const approvalRef = userDocument(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId));
  const documentsQuery = userCollection(uid, JOB_AGENT_COLLECTIONS.documents)
    .where("applicationId", "==", applicationId);
  const answersQuery = userCollection(uid, JOB_AGENT_COLLECTIONS.answers)
    .where("applicationId", "==", applicationId);
  const profileRef = userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current");
  let output: {
    application: Application;
    approval: Approval;
    attempt: SubmissionAttempt;
    completionToken: string;
  } | null = null;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const [
        applicationSnapshot,
        approvalSnapshot,
        documentsSnapshot,
        answersSnapshot,
        profileSnapshot,
      ] = await Promise.all([
        transaction.get(appRef),
        transaction.get(approvalRef),
        transaction.get(documentsQuery),
        transaction.get(answersQuery),
        transaction.get(profileRef),
      ]);
      if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
      if (!approvalSnapshot.exists) throw new HttpError(409, "Final submission approval is missing");
      const { application, plan, bridgePlan } = parseStoredApplication({
        id: applicationSnapshot.id,
        ...applicationSnapshot.data(),
      } as StoredApplication);
      if (!plan) throw new HttpError(409, "The current autofill plan is missing");
      const actualPlanHash = hashAutofillPlan(plan);
      if (actualPlanHash !== expectedPlanHash || application.autofillPlanHash !== expectedPlanHash) {
        throw new HttpError(409, "The approved autofill plan has changed");
      }
      const storedApproval = { id: approvalSnapshot.id, ...approvalSnapshot.data() } as StoredApproval;
      const approval = approvalSchema.parse(storedApproval);
      const documents = documentsSnapshot.docs.map((document) => document.data() as StoredApplicationDocument);
      const answers = answersSnapshot.docs.map((document) => document.data() as StoredApplicationAnswer);
      const profile = profileSnapshot.exists
        ? candidateProfileSchema.parse(profileSnapshot.data()?.profile)
        : himakarCandidateProfile;
      const currentBinding = approvalBindingFor({ profile, documents, answers });
      if (!sameApprovalBinding(storedApproval.binding, currentBinding)) {
        throw new HttpError(409, "Candidate evidence, documents or answers changed after submission approval");
      }
      for (const document of documents) {
        const content = groundedApplicationContentSchema.parse(document.content);
        if (!validateGroundedStatements(allGroundedStatements(content), profile).valid) {
          throw new HttpError(409, "Application documents failed current evidence validation");
        }
      }
      const consumed = consumeSubmissionApproval({
        application,
        approval,
        plan,
        consumedAt: new Date().toISOString(),
      });
      const issued = createSubmissionAttempt({
        applicationId,
        approvalId: consumed.approval.id,
        planHash: actualPlanHash,
        issuedAt: consumed.approval.consumedAt!,
        approvalExpiresAt: consumed.approval.expiresAt,
      });
      transaction.set(approvalRef, { ...consumed.approval, binding: storedApproval.binding });
      transaction.set(appRef, {
        ...consumed.application,
        ...encryptStoredPlans(plan, bridgePlan),
        submissionAttempt: issued.attempt,
      }, { merge: true });
      output = { ...consumed, ...issued };
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Submission approval was not consumed");
  const consumed = output as {
    application: Application;
    approval: Approval;
    attempt: SubmissionAttempt;
    completionToken: string;
  };
  await recordAuditEvent(uid, {
    applicationId,
    type: "submission_attempted",
    metadata: {
      planHash: consumed.approval.planHash,
      attemptId: consumed.attempt.id,
      summary: "Single-use submission approval consumed and a worker completion receipt issued",
    },
  });
  return {
    application: applicationView(consumed.application),
    approval: consumed.approval,
    attempt: {
      ...submissionAttemptView(consumed.attempt),
      completionToken: consumed.completionToken,
    },
  };
}

export async function recordWorkerSubmissionResult(
  uid: string,
  applicationId: string,
  result: SubmissionResultInput,
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const approvalRef = userDocument(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId));
  let output: { application: Application; attempt: SubmissionAttempt } | null = null;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const [applicationSnapshot, approvalSnapshot] = await Promise.all([
        transaction.get(appRef),
        transaction.get(approvalRef),
      ]);
      if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
      if (!approvalSnapshot.exists) throw new HttpError(409, "Consumed submission approval is missing");
      const current = parseStoredApplication({
        id: applicationSnapshot.id,
        ...applicationSnapshot.data(),
      } as StoredApplication);
      const approval = approvalSchema.parse({ id: approvalSnapshot.id, ...approvalSnapshot.data() });
      if (!current.plan || !current.submissionAttempt || !current.application.applicationUrl) {
        throw new HttpError(409, "A pending worker submission attempt is required");
      }
      if (approval.status !== "consumed" || approval.id !== current.submissionAttempt.approvalId) {
        throw new HttpError(409, "The submission attempt is not bound to a consumed approval");
      }
      const now = new Date().toISOString();
      const attempt = consumeSubmissionResult({
        attempt: current.submissionAttempt,
        result,
        applicationUrl: current.application.applicationUrl,
        now,
      });

      let application = current.application;
      if (attempt.status === "confirmed") {
        application = recordSuccessfulSubmission({
          application,
          consumedApproval: approval,
          plan: current.plan,
          submittedAt: result.observedAt,
        });
      } else if (attempt.status === "failed") {
        application = transitionApplication(application, "FAILED", { now });
      } else {
        application = applicationSchema.parse({ ...application, updatedAt: now });
      }
      transaction.set(appRef, {
        ...application,
        ...encryptStoredPlans(current.plan, current.bridgePlan),
        submissionAttempt: attempt,
      }, { merge: true });
      output = { application, attempt };
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Submission result was not recorded");
  const recorded = output as { application: Application; attempt: SubmissionAttempt };
  await recordAuditEvent(uid, {
    applicationId,
    type: "submission_result",
    metadata: {
      outcome: recorded.attempt.status,
      attemptId: recorded.attempt.id,
      portal: recorded.attempt.result?.portal,
      ruleId: recorded.attempt.result?.ruleId,
      screenshotSha256: recorded.attempt.result?.screenshotSha256,
      summary: recorded.attempt.status === "confirmed"
        ? "Authenticated browser worker reported verified portal submission success"
        : "Authenticated browser worker reported an unconfirmed submission outcome",
    },
  });
  return {
    application: applicationView(recorded.application),
    attempt: submissionAttemptView(recorded.attempt),
  };
}

export async function getSubmissionAttempt(uid: string, applicationId: string) {
  const { submissionAttempt } = await getStoredApplication(uid, applicationId);
  return submissionAttemptView(submissionAttempt);
}

export async function manuallyResolveSubmissionResult(
  uid: string,
  applicationId: string,
  input: ManualSubmissionResolution,
) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const approvalRef = userDocument(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId));
  let output: { application: Application; attempt: SubmissionAttempt } | null = null;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const [applicationSnapshot, approvalSnapshot] = await Promise.all([
        transaction.get(appRef),
        transaction.get(approvalRef),
      ]);
      if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
      if (!approvalSnapshot.exists) throw new HttpError(409, "Consumed submission approval is missing");
      const current = parseStoredApplication({
        id: applicationSnapshot.id,
        ...applicationSnapshot.data(),
      } as StoredApplication);
      const approval = approvalSchema.parse({ id: approvalSnapshot.id, ...approvalSnapshot.data() });
      const attempt = current.submissionAttempt;
      const currentPlanHash = current.plan ? hashAutofillPlan(current.plan) : null;
      if (
        !attempt
        || attempt.id !== input.attemptId
        || attempt.applicationId !== applicationId
        || attempt.status !== "unknown"
        || !current.plan
        || approval.status !== "consumed"
        || approval.id !== attempt.approvalId
        || approval.applicationId !== applicationId
        || approval.planHash !== attempt.planHash
        || current.application.id !== applicationId
        || current.application.status !== "SUBMISSION_APPROVED"
        || current.application.autofillPlanHash !== attempt.planHash
        || currentPlanHash !== attempt.planHash
      ) {
        throw new HttpError(409, "Only the current unknown submission attempt can be manually resolved");
      }
      const confirmedAt = Date.parse(input.confirmedAt);
      const earliestConfirmation = Date.parse(attempt.completedAt ?? attempt.issuedAt);
      if (
        !Number.isFinite(confirmedAt)
        || confirmedAt < earliestConfirmation
        || confirmedAt > Date.now() + 30_000
      ) {
        throw new HttpError(400, "Manual confirmation time is invalid");
      }
      const application = input.resolution === "submitted"
        ? recordSuccessfulSubmission({
            application: current.application,
            consumedApproval: approval,
            plan: current.plan,
            submittedAt: input.confirmedAt,
          })
        : transitionApplication(current.application, "READY_TO_SUBMIT", {
            now: input.confirmedAt,
          });
      const resolvedAttempt = submissionAttemptSchema.parse({
        ...attempt,
        status: input.resolution === "submitted"
          ? "manually_confirmed"
          : "manually_not_submitted",
        completedAt: input.confirmedAt,
      });
      transaction.set(appRef, {
        ...application,
        ...encryptStoredPlans(current.plan, current.bridgePlan),
        submissionAttempt: resolvedAttempt,
      }, { merge: true });
      output = { application, attempt: resolvedAttempt };
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Manual submission resolution was not recorded");
  const resolved = output as { application: Application; attempt: SubmissionAttempt };
  await recordAuditEvent(uid, {
    applicationId,
    type: "submission_result",
    metadata: {
      outcome: resolved.attempt.status,
      resolution: input.resolution,
      attemptId: resolved.attempt.id,
      summary: input.resolution === "submitted"
        ? "User explicitly confirmed an otherwise unknown portal submission outcome"
        : "User explicitly confirmed the unknown attempt did not submit",
    },
  });
  return {
    application: applicationView(resolved.application),
    attempt: submissionAttemptView(resolved.attempt),
  };
}

export async function revokeFinalSubmissionApproval(uid: string, applicationId: string) {
  const appRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const approvalRef = userDocument(uid, JOB_AGENT_COLLECTIONS.approvals, approvalId(applicationId));
  let output: { application: Application; approval: Approval } | null = null;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const [applicationSnapshot, approvalSnapshot] = await Promise.all([
        transaction.get(appRef),
        transaction.get(approvalRef),
      ]);
      if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
      if (!approvalSnapshot.exists) throw new HttpError(404, "Submission approval not found");
      const { application, plan, bridgePlan } = parseStoredApplication({
        id: applicationSnapshot.id,
        ...applicationSnapshot.data(),
      } as StoredApplication);
      const approval = approvalSchema.parse({ id: approvalSnapshot.id, ...approvalSnapshot.data() });
      const revoked = revokeSubmissionApproval(application, approval, new Date().toISOString());
      transaction.set(approvalRef, revoked.approval);
      transaction.set(appRef, {
        ...revoked.application,
        ...encryptStoredPlans(plan, bridgePlan),
        submissionAttempt: null,
      }, { merge: true });
      output = revoked;
    });
  } catch (error) {
    asDomainError(error);
  }
  if (!output) throw new HttpError(500, "Submission approval was not revoked");
  const revoked = output as { application: Application; approval: Approval };
  return {
    application: applicationView(revoked.application),
    approval: revoked.approval,
  };
}

export async function updateApplicationTracking(
  uid: string,
  applicationId: string,
  updates: Partial<ApplicationTracking>,
) {
  const ref = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  let output: { application: Application; tracking: ApplicationTracking } | null = null;
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpError(404, "Application not found");
    const current = parseStoredApplication({ id: snapshot.id, ...snapshot.data() } as StoredApplication);
    const tracking: ApplicationTracking = {
      ...current.tracking,
      ...updates,
    };
    const application = applicationSchema.parse({
      ...current.application,
      updatedAt: new Date().toISOString(),
    });
    transaction.set(ref, { ...application, tracking }, { merge: true });
    output = { application, tracking };
  });
  if (!output) throw new HttpError(500, "Application tracking was not updated");
  const updated = output as { application: Application; tracking: ApplicationTracking };
  return applicationView(updated.application, updated.tracking);
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const text = /^[\t\r\n ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function exportApplicationsCsv(uid: string, status?: string) {
  const applications = await listApplications(uid, { status, limit: 200 });
  const headers = [
    "id",
    "company",
    "role",
    "status",
    "source",
    "jobUrl",
    "applicationUrl",
    "fitScore",
    "eligibility",
    "dateDiscovered",
    "dateApplied",
    "closingDate",
    "contactPerson",
    "followUpDate",
    "resumeUsed",
    "coverLetterUsed",
    "outcome",
    "notes",
  ];
  const rows = applications.map((application) => headers.map((header) =>
    csvCell(application[header as keyof typeof application]),
  ).join(","));
  return `\uFEFF${headers.join(",")}\r\n${rows.join("\r\n")}\r\n`;
}
