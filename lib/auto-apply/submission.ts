/**
 * Assisted application preparation logic.
 * Final submission is always a user action.
 */

export type SubmissionStatus = "success" | "failed" | "pending_manual_action";

export type ManualActionType = "captcha" | "file_upload" | "mfa" | "custom_question" | "form_review";

export interface SubmissionAttempt {
  queueItemId: string;
  jobUrl: string;
  attemptNumber: number;
  timestamp: string;

  // Pre-submission checks
  preChecks: {
    siteReachable: boolean;
    formDetectable: boolean;
    requiredFieldsPresent: boolean;
    errors?: string[];
  };

  // Auto-fill results
  autoFill?: {
    success: boolean;
    fieldsFilled: string[];
    fieldsSkipped: string[];
    adapter?: string;
    note?: string;
  };

  // Manual actions detected
  manualActions: {
    taskType: ManualActionType;
    description: string;
    instructions?: string;
  }[];

  // Submission result
  result: {
    status: SubmissionStatus;
    message: string;
    detailedError?: string;
  };
}

export interface PreSubmissionCheck {
  siteReachable: boolean;
  responseTime: number; // milliseconds
  statusCode?: number;
  applicationPageFound: boolean;
  formDetected: boolean;
  estimatedFields: string[];
  detectedChallenges: string[]; // "captcha", "mfa", "file_upload", etc
}

export interface FormDetectionResult {
  detected: boolean;
  formProvider?: string; // "greenhouse", "workday", "generic", etc
  fields: {
    name: string;
    type: string;
    required: boolean;
    value?: string;
  }[];
  hasCaptcha: boolean;
  requiresAuth: boolean;
  estimatedFillTime: number; // seconds
}

/**
 * Builds the only safe queue update for scheduler work that has not been
 * completed in a supervised browser.
 */
export function createReviewRequiredQueueUpdate(
  timestamp: string = new Date().toISOString(),
) {
  return {
    status: "manual_action_needed" as const,
    applicationResult: {
      success: false,
      timestamp,
    },
  };
}

/**
 * Legacy compatibility pre-check.
 *
 * The legacy queue only prepares a manual-review task, so it must not make a
 * server-side request to an employer-controlled URL. In particular, following
 * redirects here would turn a stored job URL into an SSRF primitive. Portal
 * reachability and form state are inspected later in the supervised browser.
 */
export async function checkSiteReachability(
  _url: string,
  _timeout: number = 10000
): Promise<PreSubmissionCheck> {
  return {
    siteReachable: false,
    responseTime: 0,
    applicationPageFound: false,
    formDetected: false,
    estimatedFields: [],
    detectedChallenges: [
      "Server-side reachability probing is disabled; review the portal in the supervised browser",
    ],
  };
}

/**
 * Legacy compatibility gate for callers that previously requested auto-submit.
 *
 * Automatic final submission is intentionally unavailable. The function still
 * reports detected blockers so callers can prepare an accurate manual-review
 * task, but it always returns shouldSubmit: false.
 */
export function shouldAttemptAutoSubmit(
  formState: FormDetectionResult,
  autoSubmitEnabled: boolean,
  allowManualActions: boolean = true
): {
  shouldSubmit: boolean;
  reasons: string[];
  requiredManualActions: ManualActionType[];
} {
  const reasons: string[] = [
    "Automatic final submission is disabled; user review and manual submission are required",
  ];
  const requiredManualActions: ManualActionType[] = [];

  if (autoSubmitEnabled) {
    reasons.push("Legacy auto-submit preference was ignored");
  }

  if (!formState.detected) {
    reasons.push("Application form not detected");
  }

  // Check for blocking challenges
  if (formState.hasCaptcha) {
    reasons.push("CAPTCHA detected - requires manual resolution");
    requiredManualActions.push("captcha");
  }

  if (formState.requiresAuth) {
    reasons.push("Additional authentication required");
    requiredManualActions.push("mfa");
  }

  // Check for required file uploads
  const requiresFileUpload = formState.fields.some((f) => f.type === "file" && f.required);
  if (requiresFileUpload) {
    reasons.push("Resume/file upload required");
    requiredManualActions.push("file_upload");
  }

  // Keep the legacy argument useful for diagnostics, but never use it to
  // authorize a final submission.
  if (requiredManualActions.length > 0 && !allowManualActions) {
    reasons.push("Detected blockers must be resolved by the user");
  }

  if (!requiredManualActions.includes("form_review")) {
    requiredManualActions.push("form_review");
  }

  return { shouldSubmit: false, reasons, requiredManualActions };
}

/**
 * Creates a submission attempt record
 */
export function createSubmissionAttempt(
  queueItemId: string,
  jobUrl: string,
  attemptNumber: number
): SubmissionAttempt {
  return {
    queueItemId,
    jobUrl,
    attemptNumber,
    timestamp: new Date().toISOString(),
    preChecks: {
      siteReachable: false,
      formDetectable: false,
      requiredFieldsPresent: false,
    },
    manualActions: [],
    result: {
      status: "failed",
      message: "Not yet attempted",
    },
  };
}

/**
 * Handles a failed submission with retry logic
 */
export function handleSubmissionFailure(
  attempt: SubmissionAttempt,
  error: Error | string,
  retryable: boolean = true
): {
  shouldRetry: boolean;
  waitSeconds: number;
  message: string;
} {
  const errorMessage = error instanceof Error ? error.message : error;

  attempt.result = {
    status: "failed",
    message: `Submission failed: ${errorMessage}`,
    detailedError: errorMessage,
  };

  if (!retryable) {
    return {
      shouldRetry: false,
      waitSeconds: 0,
      message: "This error is not retryable",
    };
  }

  // Exponential backoff: 30, 120, 300 seconds
  const backoffTimes = [30, 120, 300];
  const waitSeconds = backoffTimes[Math.min(attempt.attemptNumber - 1, backoffTimes.length - 1)];

  return {
    shouldRetry: true,
    waitSeconds,
    message: `Will retry in ${waitSeconds} seconds`,
  };
}

/**
 * Logs a submission event for analytics
 */
export function logSubmissionEvent(
  userId: string,
  attempt: SubmissionAttempt
): {
  eventType: string;
  eventData: Record<string, unknown>;
} {
  return {
    eventType: "submission_attempt",
    eventData: {
      userId,
      queueItemId: attempt.queueItemId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.result.status,
      siteReachable: attempt.preChecks.siteReachable,
      formDetected: attempt.preChecks.formDetectable,
      manualActionsRequired: attempt.manualActions.length,
      timestamp: attempt.timestamp,
    },
  };
}
