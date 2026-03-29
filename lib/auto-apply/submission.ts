/**
 * Smart Application Submission Logic
 * Handles the process of applying to jobs including form detection, filling, and submission
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
 * Checks if a site is reachable and application page exists
 */
export async function checkSiteReachability(
  url: string,
  timeout: number = 10000
): Promise<PreSubmissionCheck> {
  const startTime = Date.now();

  try {
    const response = await Promise.race([
      fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (ApplyFlow Job Application Bot)",
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout)
      ),
    ]);

    const responseTime = Date.now() - startTime;

    return {
      siteReachable: true,
      responseTime,
      statusCode: response.status,
      applicationPageFound: response.status === 200,
      formDetected: true, // Would need to actually parse HTML
      estimatedFields: [],
      detectedChallenges: [],
    };
  } catch (error) {
    return {
      siteReachable: false,
      responseTime: Date.now() - startTime,
      applicationPageFound: false,
      formDetected: false,
      estimatedFields: [],
      detectedChallenges: [
        error instanceof Error
          ? error.message
          : "Unknown error",
      ],
    };
  }
}

/**
 * Decides whether to attempt auto-submission based on form state
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
  const reasons: string[] = [];
  const requiredManualActions: ManualActionType[] = [];

  if (!autoSubmitEnabled) {
    reasons.push("Auto-submit is disabled");
    return { shouldSubmit: false, reasons, requiredManualActions };
  }

  if (!formState.detected) {
    reasons.push("Application form not detected");
    return { shouldSubmit: false, reasons, requiredManualActions };
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

  // If manual actions found and not allowed, can't submit
  if (requiredManualActions.length > 0 && !allowManualActions) {
    reasons.push("Cannot auto-submit due to required manual actions");
    return { shouldSubmit: false, reasons, requiredManualActions };
  }

  // If we can submit (no blockers or manual actions allowed)
  if (requiredManualActions.length === 0) {
    return { shouldSubmit: true, reasons: ["All required fields detectable"], requiredManualActions };
  }

  // If manual actions allowed, we can still submit them first
  if (allowManualActions) {
    return {
      shouldSubmit: true,
      reasons: ["Will create manual tasks for challenges"],
      requiredManualActions,
    };
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
