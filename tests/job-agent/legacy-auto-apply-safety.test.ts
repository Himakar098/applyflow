import { describe, expect, it } from "vitest";
import { DEFAULT_AUTO_APPLY_CONFIG } from "../../lib/auto-apply/config";
import {
  createManualTask,
  type ManualTaskInput,
} from "../../lib/auto-apply/manual-tasks";
import {
  createReviewRequiredQueueUpdate,
  shouldAttemptAutoSubmit,
  type FormDetectionResult,
} from "../../lib/auto-apply/submission";

const READY_FORM: FormDetectionResult = {
  detected: true,
  fields: [
    {
      name: "fullName",
      type: "text",
      required: true,
      value: "Himakar",
    },
  ],
  hasCaptcha: false,
  requiresAuth: false,
  estimatedFillTime: 10,
};

const MANUAL_TASK_INPUT: ManualTaskInput = {
  jobId: "job-1",
  queueId: "queue-1",
  taskType: "form_review",
  title: "Review application",
  description: "Review every field",
  jobTitle: "Data Analyst",
  company: "Example Company",
  applicationUrl: "https://example.com/apply",
};

describe("legacy assisted-apply submission safety", () => {
  it("refuses automatic final submission even when the legacy flag is enabled", () => {
    const decision = shouldAttemptAutoSubmit(READY_FORM, true, true);

    expect(decision.shouldSubmit).toBe(false);
    expect(decision.requiredManualActions).toContain("form_review");
    expect(decision.reasons.join(" ")).toMatch(/manual submission/i);
  });

  it("keeps CAPTCHA, authentication, and file upload blockers visible", () => {
    const decision = shouldAttemptAutoSubmit(
      {
        ...READY_FORM,
        hasCaptcha: true,
        requiresAuth: true,
        fields: [{ name: "resume", type: "file", required: true }],
      },
      true,
      false,
    );

    expect(decision.shouldSubmit).toBe(false);
    expect(decision.requiredManualActions).toEqual([
      "captcha",
      "mfa",
      "file_upload",
      "form_review",
    ]);
  });

  it("forces new manual tasks to remain non-submitting even with stale input", () => {
    const staleInput = {
      ...MANUAL_TASK_INPUT,
      autoSubmitAfterCompletion: true,
    } as ManualTaskInput & { autoSubmitAfterCompletion: boolean };

    const task = createManualTask("user-1", staleInput, "task-1");

    expect(task.autoSubmitAfterCompletion).toBe(false);
  });

  it("uses review-before-submit as the only configuration mode", () => {
    expect(DEFAULT_AUTO_APPLY_CONFIG.submissionMode).toBe("review_before_submit");
    expect(DEFAULT_AUTO_APPLY_CONFIG).not.toHaveProperty("autoSubmit");
  });

  it("never turns scheduler placeholder work into a submitted receipt", () => {
    const update = createReviewRequiredQueueUpdate("2026-07-18T00:00:00.000Z");

    expect(update).toEqual({
      status: "manual_action_needed",
      applicationResult: {
        success: false,
        timestamp: "2026-07-18T00:00:00.000Z",
      },
    });
    expect(update).not.toHaveProperty("completedAt");
    expect(update.applicationResult).not.toHaveProperty("submittedUrl");
  });
});
