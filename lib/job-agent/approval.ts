import { createHash } from "node:crypto";
import {
  applicationSchema,
  approvalSchema,
  autofillPlanSchema,
  type Application,
  type ApplicationState,
  type Approval,
  type AutofillPlan,
} from "./schemas";

const TRANSITIONS: Readonly<Record<ApplicationState, readonly ApplicationState[]>> = {
  DRAFT: ["READY_FOR_REVIEW", "FAILED", "WITHDRAWN"],
  READY_FOR_REVIEW: ["DRAFT", "APPROVED_FOR_AUTOFILL", "FAILED", "WITHDRAWN"],
  APPROVED_FOR_AUTOFILL: ["READY_FOR_REVIEW", "AUTOFILL_IN_PROGRESS", "FAILED", "WITHDRAWN"],
  AUTOFILL_IN_PROGRESS: ["AUTOFILL_PAUSED", "READY_TO_SUBMIT", "FAILED", "WITHDRAWN"],
  AUTOFILL_PAUSED: ["AUTOFILL_IN_PROGRESS", "READY_FOR_REVIEW", "FAILED", "WITHDRAWN"],
  READY_TO_SUBMIT: ["AUTOFILL_PAUSED", "SUBMISSION_APPROVED", "FAILED", "WITHDRAWN"],
  SUBMISSION_APPROVED: ["READY_TO_SUBMIT", "SUBMITTED", "FAILED", "WITHDRAWN"],
  SUBMITTED: ["WITHDRAWN"],
  FAILED: ["DRAFT", "READY_FOR_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

type TransitionContext = {
  now: string;
  explicitUserApproval?: boolean;
  userInitiated?: boolean;
  submissionApproval?: Approval;
  currentPlanHash?: string;
};

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

export function hashAutofillPlan(plan: AutofillPlan): string {
  const validated = autofillPlanSchema.parse(plan);
  return createHash("sha256").update(JSON.stringify(stableValue(validated))).digest("hex");
}

export function isApplicationTransitionAllowed(
  from: ApplicationState,
  to: ApplicationState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Central state machine. Special side-effect states additionally require the
 * relevant explicit approval context; callers cannot bypass them with a plain
 * status update.
 */
export function transitionApplication(
  application: Application,
  nextState: ApplicationState,
  context: TransitionContext,
): Application {
  const current = applicationSchema.parse(application);
  if (!isApplicationTransitionAllowed(current.status, nextState)) {
    throw new Error(`Invalid application transition: ${current.status} -> ${nextState}`);
  }
  if (nextState === "APPROVED_FOR_AUTOFILL" && context.explicitUserApproval !== true) {
    throw new Error("Autofill approval requires an explicit user action.");
  }
  if (nextState === "AUTOFILL_IN_PROGRESS" && context.userInitiated !== true) {
    throw new Error("Autofill cannot start without a user-initiated action.");
  }
  if (nextState === "SUBMISSION_APPROVED") {
    const approval = context.submissionApproval;
    if (!approval || approval.status !== "granted") {
      throw new Error("Final submission requires an explicit granted approval.");
    }
    if (approval.applicationId !== current.id) {
      throw new Error("Submission approval belongs to a different application.");
    }
    if (!context.currentPlanHash || approval.planHash !== context.currentPlanHash) {
      throw new Error("Submission approval does not match the current autofill plan.");
    }
  }
  if (nextState === "SUBMITTED") {
    const approval = context.submissionApproval;
    if (!approval || approval.status !== "consumed") {
      throw new Error("Submitted state requires a consumed single-use approval.");
    }
    if (approval.applicationId !== current.id || approval.planHash !== context.currentPlanHash) {
      throw new Error("Consumed approval does not match this application and plan.");
    }
  }

  return applicationSchema.parse({
    ...current,
    status: nextState,
    dateApplied: nextState === "SUBMITTED" ? context.now : current.dateApplied,
    updatedAt: context.now,
  });
}

export function attachAutofillPlan(
  application: Application,
  plan: AutofillPlan,
  now: string,
): Application {
  const current = applicationSchema.parse(application);
  const validatedPlan = autofillPlanSchema.parse(plan);
  if (current.id !== validatedPlan.applicationId) {
    throw new Error("Autofill plan belongs to a different application.");
  }
  if (!["READY_FOR_REVIEW", "APPROVED_FOR_AUTOFILL", "AUTOFILL_PAUSED"].includes(current.status)) {
    throw new Error(`Cannot attach an autofill plan while application is ${current.status}.`);
  }
  return applicationSchema.parse({
    ...current,
    autofillPlanHash: hashAutofillPlan(validatedPlan),
    updatedAt: now,
  });
}

export function approveApplicationForAutofill(
  application: Application,
  explicitUserApproval: boolean,
  now: string,
): Application {
  if (!application.autofillPlanHash) throw new Error("Prepare an autofill plan before approval.");
  return transitionApplication(application, "APPROVED_FOR_AUTOFILL", {
    now,
    explicitUserApproval,
  });
}

export function startApprovedAutofill(
  application: Application,
  userInitiated: boolean,
  now: string,
): Application {
  return transitionApplication(application, "AUTOFILL_IN_PROGRESS", {
    now,
    userInitiated,
  });
}

export function pauseAutofill(application: Application, now: string): Application {
  if (application.status !== "AUTOFILL_IN_PROGRESS") {
    throw new Error("Only an active autofill session can be paused.");
  }
  return transitionApplication(application, "AUTOFILL_PAUSED", { now });
}

export function pauseForDetectedChallenge(
  application: Application,
  plan: AutofillPlan,
  now: string,
): { application: Application; reasons: string[] } {
  const validatedPlan = autofillPlanSchema.parse(plan);
  if (validatedPlan.applicationId !== application.id) {
    throw new Error("Autofill plan belongs to a different application.");
  }
  const reasons = [
    ...validatedPlan.detectedChallenges.map((challenge) => `Detected ${challenge}`),
    ...validatedPlan.unknownQuestions.map((question) => `Unknown question: ${question}`),
  ];
  if (reasons.length === 0) {
    throw new Error("No challenge requiring a pause was detected.");
  }
  return { application: pauseAutofill(application, now), reasons };
}

export function resumeAutofill(
  application: Application,
  userInitiated: boolean,
  now: string,
): Application {
  return transitionApplication(application, "AUTOFILL_IN_PROGRESS", { now, userInitiated });
}

export function markApplicationReadyToSubmit(
  application: Application,
  plan: AutofillPlan,
  now: string,
): Application {
  const planHash = hashAutofillPlan(plan);
  if (application.autofillPlanHash !== planHash) {
    throw new Error("The current autofill plan differs from the approved plan.");
  }
  if (plan.unknownQuestions.length > 0 || plan.detectedChallenges.length > 0) {
    throw new Error("Resolve all unknown questions and browser challenges before submission review.");
  }
  if (plan.fields.some((field) => field.requiresUserReview && !field.approved)) {
    throw new Error("All review-required autofill fields must be approved.");
  }
  return transitionApplication(application, "READY_TO_SUBMIT", { now });
}

type GrantSubmissionApprovalInput = {
  approvalId: string;
  application: Application;
  plan: AutofillPlan;
  explicitUserApproval: boolean;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string | null;
};

export function grantSubmissionApproval(input: GrantSubmissionApprovalInput): {
  application: Application;
  approval: Approval;
} {
  if (input.application.status !== "READY_TO_SUBMIT") {
    throw new Error("Application must be ready to submit before final approval.");
  }
  if (input.explicitUserApproval !== true) {
    throw new Error("Final submission approval requires an explicit per-application user action.");
  }
  const planHash = hashAutofillPlan(input.plan);
  if (input.application.autofillPlanHash !== planHash) {
    throw new Error("Final approval plan hash does not match the reviewed autofill plan.");
  }
  const approval = approvalSchema.parse({
    id: input.approvalId,
    applicationId: input.application.id,
    action: "final_submission",
    planHash,
    status: "granted",
    grantedBy: input.grantedBy,
    grantedAt: input.grantedAt,
    expiresAt: input.expiresAt ?? null,
    consumedAt: null,
  });
  return {
    approval,
    application: transitionApplication(input.application, "SUBMISSION_APPROVED", {
      now: input.grantedAt,
      submissionApproval: approval,
      currentPlanHash: planHash,
    }),
  };
}

type ConsumeSubmissionApprovalInput = {
  application: Application;
  approval: Approval;
  plan: AutofillPlan;
  consumedAt: string;
};

/**
 * Consumes approval before a submission adapter is allowed to press Submit.
 * A consumed approval cannot be reused, and editing the plan invalidates it.
 */
export function consumeSubmissionApproval(input: ConsumeSubmissionApprovalInput): {
  application: Application;
  approval: Approval;
} {
  const approval = approvalSchema.parse(input.approval);
  if (input.application.status !== "SUBMISSION_APPROVED") {
    throw new Error("Application has not reached SUBMISSION_APPROVED.");
  }
  if (approval.status !== "granted" || approval.consumedAt) {
    throw new Error("Submission approval has already been consumed or is no longer valid.");
  }
  if (approval.expiresAt && Date.parse(input.consumedAt) > Date.parse(approval.expiresAt)) {
    throw new Error("Submission approval has expired.");
  }
  const currentPlanHash = hashAutofillPlan(input.plan);
  if (
    approval.applicationId !== input.application.id
    || approval.planHash !== currentPlanHash
    || input.application.autofillPlanHash !== currentPlanHash
  ) {
    throw new Error("Submission approval is invalid for the current application plan.");
  }

  const consumedApproval = approvalSchema.parse({
    ...approval,
    status: "consumed",
    consumedAt: input.consumedAt,
  });
  return {
    approval: consumedApproval,
    application: applicationSchema.parse({ ...input.application, updatedAt: input.consumedAt }),
  };
}

/** Marks success only after the portal adapter confirms the submission result. */
export function recordSuccessfulSubmission(input: {
  application: Application;
  consumedApproval: Approval;
  plan: AutofillPlan;
  submittedAt: string;
}): Application {
  const currentPlanHash = hashAutofillPlan(input.plan);
  return transitionApplication(input.application, "SUBMITTED", {
    now: input.submittedAt,
    submissionApproval: input.consumedApproval,
    currentPlanHash,
  });
}

export function revokeSubmissionApproval(
  application: Application,
  approval: Approval,
  now: string,
): { application: Application; approval: Approval } {
  if (application.status !== "SUBMISSION_APPROVED" || approval.status !== "granted") {
    throw new Error("Only a granted approval for a submission-approved application can be revoked.");
  }
  return {
    approval: approvalSchema.parse({ ...approval, status: "revoked" }),
    application: transitionApplication(application, "READY_TO_SUBMIT", { now }),
  };
}
