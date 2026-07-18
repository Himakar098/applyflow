import { describe, expect, it } from "vitest";

import {
  consumeSubmissionResult,
  createSubmissionAttempt,
} from "@/lib/job-agent/server/submission-receipts";

const planHash = "a".repeat(64);

function confirmedResult(attemptId: string, completionToken: string) {
  return {
    attemptId,
    completionToken,
    planHash,
    outcome: "confirmed" as const,
    observedAt: "2026-07-18T10:00:10.000Z",
    observedUrl: "https://boards.greenhouse.io/company/jobs/123/confirmation",
    portal: "greenhouse" as const,
    verification: {
      ruleId: "greenhouse_confirmation_page_v1" as const,
      matchedSignals: [
        "confirmation_heading" as const,
        "submit_control_absent" as const,
        "no_validation_errors" as const,
      ],
      noValidationErrors: true,
      confirmationTextSha256: "b".repeat(64),
      screenshotSha256: "c".repeat(64),
    },
  };
}

describe("submission completion receipts", () => {
  it("accepts one recognized, plan-bound worker confirmation", () => {
    const issued = createSubmissionAttempt({
      applicationId: "application-1",
      approvalId: "submission-application-1",
      planHash,
      issuedAt: "2026-07-18T10:00:00.000Z",
      approvalExpiresAt: "2026-07-18T10:10:00.000Z",
    });
    const consumed = consumeSubmissionResult({
      attempt: issued.attempt,
      result: confirmedResult(issued.attempt.id, issued.completionToken),
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:11.000Z",
    });
    expect(consumed.status).toBe("confirmed");
    expect(consumed.completionTokenHash).toBeNull();
  });

  it("rejects forged, replayed, and incomplete confirmation evidence", () => {
    const issued = createSubmissionAttempt({
      applicationId: "application-1",
      approvalId: "submission-application-1",
      planHash,
      issuedAt: "2026-07-18T10:00:00.000Z",
    });
    expect(() => consumeSubmissionResult({
      attempt: issued.attempt,
      result: confirmedResult(issued.attempt.id, "x".repeat(43)),
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:11.000Z",
    })).toThrow(/receipt is invalid/i);

    const incomplete = confirmedResult(issued.attempt.id, issued.completionToken);
    incomplete.verification.matchedSignals = ["confirmation_heading"];
    expect(() => consumeSubmissionResult({
      attempt: issued.attempt,
      result: incomplete,
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:11.000Z",
    })).toThrow(/complete portal success evidence/i);

    const consumed = consumeSubmissionResult({
      attempt: issued.attempt,
      result: confirmedResult(issued.attempt.id, issued.completionToken),
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:11.000Z",
    });
    expect(() => consumeSubmissionResult({
      attempt: consumed,
      result: confirmedResult(issued.attempt.id, issued.completionToken),
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:12.000Z",
    })).toThrow(/already been consumed/i);
  });

  it("rejects registrable lookalikes for known portal hostnames", () => {
    const issued = createSubmissionAttempt({
      applicationId: "application-1",
      approvalId: "submission-application-1",
      planHash,
      issuedAt: "2026-07-18T10:00:00.000Z",
    });
    const result = confirmedResult(issued.attempt.id, issued.completionToken);
    result.observedUrl = "https://evilgreenhouse.io/confirmation";
    expect(() => consumeSubmissionResult({
      attempt: issued.attempt,
      result,
      applicationUrl: "https://boards.greenhouse.io/company/jobs/123",
      now: "2026-07-18T10:00:11.000Z",
    })).toThrow(/does not match the application portal/i);
  });
});
