import { describe, expect, it } from "vitest";

import {
  applicationSchema,
  extractJobDescription,
  himakarCandidateProfile,
  validateGroundedStatements,
} from "@/lib/job-agent";
import {
  allGroundedFollowUpStatements,
  generateGroundedFollowUpMaterials,
} from "@/lib/job-agent/server/follow-up-materials";

describe("grounded follow-up materials", () => {
  it("creates review-only, unsent drafts from canonical evidence", () => {
    const job = extractJobDescription({
      id: "job-1",
      description: "Applied AI Engineer at Example Co in Perth. Build TypeScript and machine learning automation with stakeholders. Full Australian working rights accepted.",
      applicationUrl: "https://example.com/jobs/1",
      extractedAt: "2026-07-18T00:00:00.000Z",
    });
    const application = applicationSchema.parse({
      id: "application-1",
      jobId: "job-1",
      candidateProfileId: himakarCandidateProfile.id,
      company: "Example Co",
      role: "Applied AI Engineer",
      source: "manual",
      jobUrl: null,
      applicationUrl: "https://example.com/jobs/1",
      fitScore: 80,
      eligibility: "eligible",
      status: "SUBMITTED",
      submissionMode: "review_before_submit",
      autofillPlanHash: "a".repeat(64),
      dateDiscovered: "2026-07-18T00:00:00.000Z",
      dateApplied: "2026-07-18T01:00:00.000Z",
      closingDate: null,
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T01:00:00.000Z",
    });
    const content = generateGroundedFollowUpMaterials({
      profile: himakarCandidateProfile,
      job,
      application,
    });
    expect(content.delivery).toBe("draft_only");
    expect(content.sent).toBe(false);
    expect(content.recruiterFollowUpEmail.body.text).toContain("[USER INPUT REQUIRED");
    expect(validateGroundedStatements(
      allGroundedFollowUpStatements(content),
      himakarCandidateProfile,
    ).valid).toBe(true);
  });
});

