import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Application, AutofillPlan as StoredAutofillPlan } from "../../../lib/job-agent/schemas";
import {
  approvalResponseSchema,
  applicationDetailResponseSchema,
  autofillMutationResponseSchema,
  autofillStateResponseSchema,
  consumedApprovalResponseSchema,
  profileResponseSchema,
  submissionResultResponseSchema,
  type AutofillStateResponse,
  type BridgeAutofillPlan,
  type ConsumedApprovalResponse,
} from "./runtime-schemas";
import { toCandidateAutofillProfile } from "./profile-mapping";
import type {
  AutofillAuthorization,
  CandidateAutofillProfile,
  SubmissionApprovalProvider,
  SubmissionResult,
} from "./types";

type FetchImplementation = typeof fetch;

type WorkerBridge = {
  open(url: string): Promise<void>;
  requestAutofillPlan(
    applicationId: string,
    profile: CandidateAutofillProfile,
  ): Promise<BridgeAutofillPlan>;
  fillApprovedFields(
    plan: BridgeAutofillPlan,
    authorization: AutofillAuthorization,
  ): Promise<{ state: "AUTOFILL_PAUSED" | "READY_TO_SUBMIT"; pauses: Array<{ message: string }> }>;
  submitApprovedApplication(
    plan: BridgeAutofillPlan,
    approvalProvider?: SubmissionApprovalProvider,
  ): Promise<SubmissionResult>;
  reportPageState(): Promise<{ url: string }>;
};

export type WorkerProgress = {
  stage:
    | "connected"
    | "plan_saved"
    | "waiting_for_autofill_start"
    | "autofill_started"
    | "autofill_paused"
    | "ready_to_submit"
    | "waiting_for_submission_approval"
    | "submission_attempted"
    | "submission_recorded";
  message: string;
};

export type SubmissionReceiptInput = {
  attemptId: string;
  completionToken: string;
  planHash: string;
  outcome: "confirmed" | "unknown" | "failed";
  observedAt: string;
  observedUrl: string;
  portal: BridgeAutofillPlan["portal"];
  verification: {
    ruleId?:
      | "generic_confirmation_screen_v1"
      | "greenhouse_confirmation_page_v1"
      | "lever_confirmation_page_v1";
    matchedSignals: Array<
      | "success_url"
      | "confirmation_heading"
      | "receipt_identifier"
      | "submit_control_absent"
      | "no_validation_errors"
    >;
    noValidationErrors: boolean;
    confirmationTextSha256?: string;
    screenshotSha256?: string;
    portalReceiptId?: string;
  };
};

function safeApplicationId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new Error("The application id is invalid.");
  }
  return value;
}

/** Credentials may cross plaintext HTTP only on the local loopback boundary. */
export function normalizeWorkerBaseUrl(value: string) {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "127.0.0.1"
    || parsed.hostname === "localhost"
    || parsed.hostname === "[::1]"
    || parsed.hostname === "::1";
  if (
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error("JOB_AGENT_BASE_URL must be an HTTPS origin or a loopback HTTP origin.");
  }
  return parsed.origin;
}

function publicApiError(payload: unknown, status: number) {
  const raw = payload && typeof payload === "object"
    ? (payload as { error?: unknown; message?: unknown }).error
      ?? (payload as { message?: unknown }).message
    : null;
  const message = typeof raw === "string"
    ? raw.replace(/[^A-Za-z0-9 _.,:;()'/-]/g, " ").slice(0, 500)
    : `HTTP ${status}`;
  return new Error(`ApplyFlow API request failed: ${message}`);
}

function publicObservedUrl(value: string) {
  const parsed = new URL(value);
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function assertSamePortalOrigin(applicationUrl: string, planUrl: string) {
  if (new URL(applicationUrl).origin !== new URL(planUrl).origin) {
    throw new Error(
      "The application redirected to another origin. Paste the final employer-portal URL and request a new reviewed plan.",
    );
  }
}

async function reportProgress(
  callback: ((progress: WorkerProgress) => void | Promise<void>) | undefined,
  progress: WorkerProgress,
) {
  try {
    await callback?.(progress);
  } catch {
    // Display/logging failures must never alter an approval or submission state.
  }
}

export class AuthenticatedJobAgentClient {
  readonly baseUrl: string;

  private readonly firebaseIdToken: string;
  private readonly workerToken: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(input: {
    baseUrl: string;
    firebaseIdToken: string;
    workerToken: string;
    fetchImplementation?: FetchImplementation;
  }) {
    this.baseUrl = normalizeWorkerBaseUrl(input.baseUrl);
    this.firebaseIdToken = input.firebaseIdToken.trim();
    this.workerToken = input.workerToken.trim();
    this.fetchImplementation = input.fetchImplementation ?? fetch;
    if (!this.firebaseIdToken) throw new Error("JOB_AGENT_FIREBASE_ID_TOKEN is required.");
    if (this.workerToken.length < 32) throw new Error("JOB_AGENT_WORKER_TOKEN must contain at least 32 characters.");
  }

  private async request(pathname: string, input: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    workerCredential?: boolean;
  } = {}) {
    const url = new URL(pathname, `${this.baseUrl}/`);
    if (url.origin !== this.baseUrl || !url.pathname.startsWith("/api/job-agent/")) {
      throw new Error("The worker refused an API URL outside the configured ApplyFlow origin.");
    }
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.firebaseIdToken}`,
    });
    if (input.body !== undefined) headers.set("Content-Type", "application/json");
    if (input.workerCredential) headers.set("x-job-agent-worker-token", this.workerToken);
    const response = await this.fetchImplementation(url, {
      method: input.method ?? "GET",
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
      redirect: "error",
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) throw publicApiError(payload, response.status);
    return payload;
  }

  async getProfile() {
    return profileResponseSchema.parse(await this.request("/api/job-agent/profile"));
  }

  async getApplicationDetail(applicationId: string) {
    const id = safeApplicationId(applicationId);
    return applicationDetailResponseSchema.parse(
      await this.request(`/api/job-agent/applications/${id}`),
    );
  }

  async downloadApplicationDocument(
    applicationId: string,
    documentId: string,
    kind: "resumeDocx" | "resumePdf" | "coverLetterDocx" | "coverLetterPdf",
  ) {
    const id = safeApplicationId(applicationId);
    const safeDocumentId = safeApplicationId(documentId);
    const url = new URL(
      `/api/job-agent/applications/${id}/documents/export`,
      `${this.baseUrl}/`,
    );
    url.searchParams.set("documentId", safeDocumentId);
    url.searchParams.set("kind", kind);
    const response = await this.fetchImplementation(url, {
      headers: {
        Accept: "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Authorization: `Bearer ${this.firebaseIdToken}`,
      },
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as unknown;
      throw publicApiError(payload, response.status);
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > 20 * 1024 * 1024) {
      throw new Error("The selected application document exceeds the worker download limit.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("The selected application document is empty or exceeds the worker download limit.");
    }
    return bytes;
  }

  async getAutofillState(applicationId: string) {
    const id = safeApplicationId(applicationId);
    return autofillStateResponseSchema.parse(
      await this.request(`/api/job-agent/applications/${id}/autofill`, {
        workerCredential: true,
      }),
    );
  }

  async autofillAction(applicationId: string, body: unknown) {
    const id = safeApplicationId(applicationId);
    const action = body && typeof body === "object"
      ? (body as { action?: unknown }).action
      : null;
    return autofillMutationResponseSchema.parse(await this.request(
      `/api/job-agent/applications/${id}/autofill`,
      {
        method: "POST",
        body,
        workerCredential: action === "save_plan" || action === "ready_to_submit",
      },
    ));
  }

  async getSubmissionApproval(applicationId: string) {
    const id = safeApplicationId(applicationId);
    return approvalResponseSchema.parse(
      await this.request(`/api/job-agent/applications/${id}/approval`),
    );
  }

  async consumeSubmissionApproval(applicationId: string, planHash: string) {
    const id = safeApplicationId(applicationId);
    return consumedApprovalResponseSchema.parse(await this.request(
      `/api/job-agent/applications/${id}/approval`,
      {
        method: "PUT",
        body: { planHash },
        workerCredential: true,
      },
    ));
  }

  async recordSubmissionResult(applicationId: string, receipt: SubmissionReceiptInput) {
    const id = safeApplicationId(applicationId);
    return submissionResultResponseSchema.parse(await this.request(
      `/api/job-agent/applications/${id}/submission-result`,
      {
        method: "POST",
        body: receipt,
        workerCredential: true,
      },
    ));
  }
}

async function prepareApplicationDocuments(
  client: AuthenticatedJobAgentClient,
  applicationId: string,
) {
  const detail = await client.getApplicationDetail(applicationId);
  const document = detail.documents.find((candidate) =>
    candidate.availableKinds.includes("resumePdf")
      || candidate.availableKinds.includes("resumeDocx")
      || candidate.availableKinds.includes("coverLetterPdf")
      || candidate.availableKinds.includes("coverLetterDocx"),
  );
  if (!document) {
    return {
      documents: undefined,
      cleanup: async () => undefined,
    };
  }
  const directory = await mkdtemp(path.join(tmpdir(), "applyflow-job-agent-documents-"));
  await chmod(directory, 0o700);
  const prepared: { resumePath?: string; coverLetterPath?: string } = {};
  try {
    const resumeKind = document.availableKinds.includes("resumePdf")
      ? "resumePdf" as const
      : document.availableKinds.includes("resumeDocx")
        ? "resumeDocx" as const
        : null;
    if (resumeKind) {
      const extension = resumeKind === "resumePdf" ? "pdf" : "docx";
      prepared.resumePath = path.join(directory, `resume.${extension}`);
      await writeFile(
        prepared.resumePath,
        await client.downloadApplicationDocument(applicationId, document.id, resumeKind),
        { flag: "wx", mode: 0o600 },
      );
    }
    const coverKind = document.availableKinds.includes("coverLetterPdf")
      ? "coverLetterPdf" as const
      : document.availableKinds.includes("coverLetterDocx")
        ? "coverLetterDocx" as const
        : null;
    if (coverKind) {
      const extension = coverKind === "coverLetterPdf" ? "pdf" : "docx";
      prepared.coverLetterPath = path.join(directory, `cover-letter.${extension}`);
      await writeFile(
        prepared.coverLetterPath,
        await client.downloadApplicationDocument(applicationId, document.id, coverKind),
        { flag: "wx", mode: 0o600 },
      );
    }
    return {
      documents: prepared,
      cleanup: async () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function approvalFieldIds(plan: StoredAutofillPlan) {
  return plan.fields.filter((field) => field.approved).map((field) => field.id);
}

function reviewedFieldIds(plan: StoredAutofillPlan) {
  return plan.fields
    .filter((field) => field.approved && field.requiresUserReview)
    .map((field) => field.id);
}

function terminalBeforeSubmission(application: Application) {
  return application.status === "WITHDRAWN"
    || application.status === "FAILED"
    || application.status === "SUBMITTED";
}

async function sha256File(filePath: string | undefined) {
  if (!filePath) return undefined;
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function confirmationRule(portal: BridgeAutofillPlan["portal"]) {
  if (portal === "generic") return "generic_confirmation_screen_v1" as const;
  if (portal === "greenhouse") return "greenhouse_confirmation_page_v1" as const;
  if (portal === "lever") return "lever_confirmation_page_v1" as const;
  return undefined;
}

async function waitForAutofillStart(input: {
  client: AuthenticatedJobAgentClient;
  applicationId: string;
  maximumPolls: number;
  sleep: (milliseconds: number) => Promise<void>;
  pollIntervalMs: number;
  onProgress?: (progress: WorkerProgress) => void | Promise<void>;
}) {
  let lastStatus = "";
  for (let attempt = 0; attempt < input.maximumPolls; attempt += 1) {
    const state = await input.client.getAutofillState(input.applicationId);
    if (terminalBeforeSubmission(state.application)) {
      throw new Error(`The application entered terminal state ${state.application.status}.`);
    }
    if (state.application.status === "AUTOFILL_IN_PROGRESS") return state;
    if (state.application.status !== lastStatus) {
      lastStatus = state.application.status;
      await reportProgress(input.onProgress, {
        stage: "waiting_for_autofill_start",
        message: `Waiting for explicit plan approval and Start; current state is ${lastStatus}.`,
      });
    }
    await input.sleep(input.pollIntervalMs);
  }
  throw new Error("Timed out waiting for the user to approve and start autofill.");
}

async function waitForFinalApproval(input: {
  client: AuthenticatedJobAgentClient;
  applicationId: string;
  maximumPolls: number;
  sleep: (milliseconds: number) => Promise<void>;
  pollIntervalMs: number;
  onProgress?: (progress: WorkerProgress) => void | Promise<void>;
}) {
  await reportProgress(input.onProgress, {
    stage: "waiting_for_submission_approval",
    message: "Waiting for a separate, one-use final submission approval.",
  });
  for (let attempt = 0; attempt < input.maximumPolls; attempt += 1) {
    const state = await input.client.getAutofillState(input.applicationId);
    if (terminalBeforeSubmission(state.application)) {
      throw new Error(`The application entered terminal state ${state.application.status}.`);
    }
    const approval = await input.client.getSubmissionApproval(input.applicationId);
    if (approval.approval?.status === "granted") return { state, approval: approval.approval };
    await input.sleep(input.pollIntervalMs);
  }
  throw new Error("Timed out waiting for final submission approval.");
}

export async function runSupervisedApplication(input: {
  applicationId: string;
  client: AuthenticatedJobAgentClient;
  bridge: WorkerBridge;
  pollIntervalMs?: number;
  maximumPolls?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  onProgress?: (progress: WorkerProgress) => void | Promise<void>;
}) {
  const applicationId = safeApplicationId(input.applicationId);
  const pollIntervalMs = input.pollIntervalMs ?? 2_000;
  const maximumPolls = input.maximumPolls ?? 3_600;
  const sleep = input.sleep ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? (() => new Date());

  let state = await input.client.getAutofillState(applicationId);
  const applicationUrl = state.application.applicationUrl;
  if (!applicationUrl) throw new Error("This application has no employer portal URL.");
  const profileResponse = await input.client.getProfile();
  const candidate = toCandidateAutofillProfile(
    profileResponse.profile,
    profileResponse.privateContact,
  );
  const preparedDocuments = await prepareApplicationDocuments(input.client, applicationId);
  candidate.documents = preparedDocuments.documents;
  try {
  await input.bridge.open(applicationUrl);
  await reportProgress(input.onProgress, { stage: "connected", message: "Visible browser connected to the selected application." });

  if (!state.workerPlan) {
    if (state.application.status !== "READY_FOR_REVIEW") {
      throw new Error("A missing browser plan can only be inspected from READY_FOR_REVIEW.");
    }
    const preparedPlan = await input.bridge.requestAutofillPlan(applicationId, candidate);
    assertSamePortalOrigin(applicationUrl, preparedPlan.url);
    await input.client.autofillAction(applicationId, {
      action: "save_plan",
      plan: preparedPlan,
    });
    await reportProgress(input.onProgress, {
      stage: "plan_saved",
      message: "Inspection plan saved. Review and approve selected fields in ApplyFlow.",
    });
  }

  state = await waitForAutofillStart({
    client: input.client,
    applicationId,
    maximumPolls,
    sleep,
    pollIntervalMs,
    onProgress: input.onProgress,
  });
  if (!state.workerPlan || !state.plan || !state.planHash) {
    throw new Error("The approved browser plan is incomplete; reload and approve it again.");
  }
  assertSamePortalOrigin(applicationUrl, state.workerPlan.url);
  if (state.application.autofillPlanHash !== state.planHash) {
    throw new Error("The approved browser plan hash changed before autofill.");
  }
  const approvedFieldIds = approvalFieldIds(state.plan);
  const approvedReviewedFieldIds = reviewedFieldIds(state.plan);
  if (!approvedFieldIds.length) {
    throw new Error("No fields were explicitly approved for autofill.");
  }

  const approvedPlanId = state.workerPlan.id;
  const approvedPlanHash = state.planHash;
  let activeWorkerPlan = state.workerPlan;
  let resumedAfterExplicitPause = false;
  await reportProgress(input.onProgress, { stage: "autofill_started", message: "Filling only explicitly approved fields." });
  let fillResult: Awaited<ReturnType<WorkerBridge["fillApprovedFields"]>>;
  while (true) {
    const approvedAt = now();
    const authorization: AutofillAuthorization = {
      scope: "single_application_autofill",
      applicationId,
      planId: approvedPlanId,
      approvedFieldIds,
      reviewedFieldIds: approvedReviewedFieldIds,
      approvedBy: "authenticated-application-owner",
      approvedAt: approvedAt.toISOString(),
      expiresAt: new Date(approvedAt.getTime() + 15 * 60_000).toISOString(),
      userInitiated: true,
    };
    fillResult = await input.bridge.fillApprovedFields(activeWorkerPlan, authorization);
    if (fillResult.state === "READY_TO_SUBMIT") break;

    await input.client.autofillAction(applicationId, {
      action: "pause",
      reason: fillResult.pauses[0]?.message ?? "Visible worker paused for user review.",
    });
    await reportProgress(input.onProgress, {
      stage: "autofill_paused",
      message: "Autofill paused. Resolve the visible browser questions manually, then click Resume in ApplyFlow. Keep this worker and browser open.",
    });
    state = await waitForAutofillStart({
      client: input.client,
      applicationId,
      maximumPolls,
      sleep,
      pollIntervalMs,
      onProgress: input.onProgress,
    });
    if (
      !state.workerPlan
      || !state.plan
      || state.workerPlan.id !== approvedPlanId
      || state.planHash !== approvedPlanHash
      || state.application.autofillPlanHash !== approvedPlanHash
    ) {
      throw new Error("The browser plan changed while autofill was paused; stop and approve a new plan.");
    }
    activeWorkerPlan = state.workerPlan;
    resumedAfterExplicitPause = true;
    await reportProgress(input.onProgress, {
      stage: "autofill_started",
      message: "Explicit Resume received. Rechecking the same reviewed plan in the existing browser session.",
    });
  }

  const finalPlan = await input.bridge.requestAutofillPlan(applicationId, candidate);
  assertSamePortalOrigin(applicationUrl, finalPlan.url);
  const manuallyReviewedFieldIds = resumedAfterExplicitPause
    ? finalPlan.mappings.filter((mapping) =>
      mapping.field.hasValue && (
        mapping.reviewRequired ||
        mapping.status === "no_match" ||
        mapping.status === "blocked"
      ),
    )
      .map((mapping) => mapping.field.id)
    : [];
  const finalReviewedFieldIds = [...new Set([
    ...approvedReviewedFieldIds,
    ...manuallyReviewedFieldIds,
  ])];
  // These additional ids represent controls already completed manually in the
  // live page. They are never added to the earlier autofill authorization.
  const finalApprovedFieldIds = [...new Set([
    ...approvedFieldIds,
    ...manuallyReviewedFieldIds,
  ])];
  const ready = await input.client.autofillAction(applicationId, {
    action: "ready_to_submit",
    plan: finalPlan,
    approvedFieldIds: finalApprovedFieldIds,
    reviewedFieldIds: finalReviewedFieldIds,
  });
  const readyPlanHash = ready.planHash ?? ready.application.autofillPlanHash;
  if (!readyPlanHash || ready.application.status !== "READY_TO_SUBMIT") {
    throw new Error("ApplyFlow did not accept the reviewed browser state as ready to submit.");
  }
  await reportProgress(input.onProgress, {
    stage: "ready_to_submit",
    message: "Autofill stopped before Submit. Review the live portal and grant final approval in ApplyFlow.",
  });

  await waitForFinalApproval({
    client: input.client,
    applicationId,
    maximumPolls,
    sleep,
    pollIntervalMs,
    onProgress: input.onProgress,
  });

  const consumedBox: { value: ConsumedApprovalResponse | null } = { value: null };
  const approvalProvider: SubmissionApprovalProvider = async (request) => {
    if (consumedBox.value) return null;
    consumedBox.value = await input.client.consumeSubmissionApproval(applicationId, readyPlanHash);
    if (
      consumedBox.value.application.id !== applicationId
      || consumedBox.value.application.status !== "SUBMISSION_APPROVED"
      || consumedBox.value.approval.applicationId !== applicationId
      || consumedBox.value.approval.status !== "consumed"
      || consumedBox.value.approval.planHash !== readyPlanHash
      || consumedBox.value.attempt.applicationId !== applicationId
      || consumedBox.value.attempt.approvalId !== consumedBox.value.approval.id
      || consumedBox.value.attempt.planHash !== readyPlanHash
    ) {
      throw new Error("The consumed approval response was not bound to this application and plan.");
    }
    const expiry = consumedBox.value.approval.expiresAt ?? consumedBox.value.attempt.expiresAt;
    return {
      ...request,
      approvedBy: consumedBox.value.approval.grantedBy,
      approvedAt: consumedBox.value.approval.grantedAt,
      expiresAt: expiry,
      verificationId: consumedBox.value.attempt.id,
      verified: true,
    };
  };

  try {
    const submission = await input.bridge.submitApprovedApplication(
      finalPlan,
      approvalProvider,
    );
    const consumed = consumedBox.value;
    if (!consumed) throw new Error("The browser did not consume the final approval.");
    await reportProgress(input.onProgress, {
      stage: "submission_attempted",
      message: "The one-use approval was consumed and the portal result was inspected.",
    });
    const confirmed = submission.state === "SUBMITTED";
    const receipt: SubmissionReceiptInput = {
      attemptId: consumed.attempt.id,
      completionToken: consumed.attempt.completionToken,
      planHash: readyPlanHash,
      outcome: confirmed ? "confirmed" : "unknown",
      observedAt: submission.submittedAt ?? submission.attemptedAt,
      observedUrl: publicObservedUrl(submission.confirmation.finalUrl),
      portal: submission.portal,
      verification: {
        ...(confirmed ? { ruleId: confirmationRule(submission.portal) } : {}),
        matchedSignals: submission.confirmation.matchedSignals,
        noValidationErrors: submission.confirmation.noValidationErrors,
        ...(confirmed ? {
          confirmationTextSha256: createHash("sha256")
            .update(JSON.stringify({
              evidence: submission.confirmationEvidence,
              finalUrl: publicObservedUrl(submission.confirmation.finalUrl),
              signals: submission.confirmation.matchedSignals,
            }))
            .digest("hex"),
          screenshotSha256: await sha256File(submission.screenshotPath),
        } : {}),
        ...(submission.confirmation.portalReceiptId
          ? { portalReceiptId: submission.confirmation.portalReceiptId }
          : {}),
      },
    };
    const recorded = await input.client.recordSubmissionResult(applicationId, receipt);
    await reportProgress(input.onProgress, {
      stage: "submission_recorded",
      message: confirmed
        ? "Verified portal success was recorded."
        : "The portal outcome was ambiguous and requires manual confirmation.",
    });
    return { state: recorded.application.status, submission, recorded };
  } catch (error) {
    const consumed = consumedBox.value;
    if (consumed) {
      const observedUrl = await input.bridge.reportPageState()
        .then((page) => page.url)
        .catch(() => applicationUrl);
      await input.client.recordSubmissionResult(applicationId, {
        attemptId: consumed.attempt.id,
        completionToken: consumed.attempt.completionToken,
        planHash: readyPlanHash,
        // Once approval is consumed we cannot prove that a click did not
        // occur. Preserve an ambiguous outcome for manual confirmation rather
        // than marking it failed and risking a duplicate application.
        outcome: "unknown",
        observedAt: now().toISOString(),
        observedUrl: publicObservedUrl(observedUrl),
        portal: finalPlan.portal,
        verification: { matchedSignals: [], noValidationErrors: false },
      }).catch(() => undefined);
    }
    throw error;
  }
  } finally {
    await preparedDocuments.cleanup();
  }
}
