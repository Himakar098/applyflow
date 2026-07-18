import { describe, expect, it } from "vitest";

import {
  applicationSchema,
  assessJobEligibility,
  attachAutofillPlan,
  approveApplicationForAutofill,
  consumeSubmissionApproval,
  extractJobDescription,
  grantSubmissionApproval,
  himakarCandidateProfile,
  markApplicationReadyToSubmit,
  proposeApplicationAnswer,
  recordSuccessfulSubmission,
  scoreJobFit,
  startApprovedAutofill,
  transitionApplication,
  validateGroundedStatements,
  type AutofillPlan,
} from "../../lib/job-agent";

const NOW = "2026-07-18T00:00:00.000Z";

describe("Job Agent supervised application path", () => {
  it("runs an eligible job from extraction to a single approved submission", () => {
    const job = extractJobDescription({
      id: "integration-data-role",
      description: [
        "Title: Junior Data Analyst",
        "Company: Health Analytics Co",
        "Location: Perth, WA",
        "Employment type: Full-time",
        "Requirements:",
        "- Python and SQL are required.",
        "- A degree in data, analytics, engineering or a related field is required.",
        "- Temporary visa holders with full working rights are welcome.",
        "Responsibilities:",
        "- Automate reporting and build dashboards.",
      ].join("\n"),
      sourceUrl: "https://jobs.example.test/integration-data-role",
      applicationUrl: "https://jobs.example.test/integration-data-role/apply",
      extractedAt: NOW,
    });
    const eligibility = assessJobEligibility(job, himakarCandidateProfile, { assessedAt: NOW });
    const fit = scoreJobFit(job, himakarCandidateProfile, eligibility, { assessedAt: NOW });

    expect(job.requiredSkills.value).toEqual(expect.arrayContaining(["Python", "SQL"]));
    expect(eligibility.decision).toBe("eligible");
    expect(fit.score).toBeGreaterThanOrEqual(80);
    expect(fit.categories.reduce((sum, item) => sum + item.maximum, 0)).toBe(100);

    const grounding = validateGroundedStatements([
      {
        text: "Automated data reporting and dashboard workflows at Kids Health / NursePrac.",
        evidenceClaimIds: ["employment-kids-health-claim"],
      },
      {
        text: "Built The Liquid Audit as an end-to-end product used in a live hotel environment.",
        evidenceClaimIds: ["project-liquid-audit-claim"],
      },
    ], himakarCandidateProfile);
    expect(grounding.valid).toBe(true);

    const answer = proposeApplicationAnswer(
      "Do you hold a Temporary Graduate subclass 485 visa?",
      himakarCandidateProfile,
    );
    expect(answer).toMatchObject({
      classification: "visa",
      proposedValue: "Yes - Temporary Graduate visa, subclass 485",
      requiresUserConfirmation: true,
      autoFillAllowed: false,
    });

    let application = applicationSchema.parse({
      id: "integration-application",
      jobId: job.id,
      candidateProfileId: himakarCandidateProfile.id,
      company: job.company.value,
      role: job.title.value,
      source: "integration-fixture",
      jobUrl: job.sourceUrl.value,
      applicationUrl: job.applicationUrl.value,
      fitScore: fit.score,
      eligibility: eligibility.decision,
      status: "DRAFT",
      submissionMode: "review_before_submit",
      autofillPlanHash: null,
      dateDiscovered: NOW,
      dateApplied: null,
      closingDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const plan: AutofillPlan = {
      id: "integration-plan",
      applicationId: application.id,
      fields: [{
        id: "preferred-name",
        label: "Preferred name",
        detectedFieldType: "text",
        proposedValue: "Himakar",
        source: "candidate.preferredName",
        confidence: 1,
        requiresUserReview: false,
        approved: true,
        sensitive: false,
      }],
      documentUploads: [],
      unknownQuestions: [],
      detectedChallenges: [],
      createdAt: NOW,
    };

    application = transitionApplication(application, "READY_FOR_REVIEW", { now: NOW });
    application = attachAutofillPlan(application, plan, NOW);
    expect(() => approveApplicationForAutofill(application, false, NOW)).toThrow(/explicit user action/i);
    application = approveApplicationForAutofill(application, true, NOW);
    expect(() => startApprovedAutofill(application, false, NOW)).toThrow(/user-initiated/i);
    application = startApprovedAutofill(application, true, NOW);
    application = markApplicationReadyToSubmit(application, plan, NOW);
    expect(() => grantSubmissionApproval({
      approvalId: "integration-approval",
      application,
      plan,
      explicitUserApproval: false,
      grantedBy: himakarCandidateProfile.id,
      grantedAt: NOW,
    })).toThrow(/explicit per-application user action/i);

    const granted = grantSubmissionApproval({
      approvalId: "integration-approval",
      application,
      plan,
      explicitUserApproval: true,
      grantedBy: himakarCandidateProfile.id,
      grantedAt: NOW,
    });
    const consumed = consumeSubmissionApproval({
      application: granted.application,
      approval: granted.approval,
      plan,
      consumedAt: "2026-07-18T00:01:00.000Z",
    });
    const submitted = recordSuccessfulSubmission({
      application: consumed.application,
      consumedApproval: consumed.approval,
      plan,
      submittedAt: "2026-07-18T00:01:00.000Z",
    });

    expect(submitted).toMatchObject({
      status: "SUBMITTED",
      dateApplied: "2026-07-18T00:01:00.000Z",
      submissionMode: "review_before_submit",
    });
    expect(consumed.approval.status).toBe("consumed");
    expect(() => consumeSubmissionApproval({
      application: granted.application,
      approval: consumed.approval,
      plan,
      consumedAt: "2026-07-18T00:02:00.000Z",
    })).toThrow(/already been consumed/i);
  });

  it("does not let a high fit score override a citizenship failure", () => {
    const job = extractJobDescription({
      id: "integration-ineligible-role",
      description: [
        "Title: Graduate AI Engineer",
        "Company: Defence Example",
        "Location: Perth, WA",
        "Requirements:",
        "- Python, TypeScript and machine learning are required.",
        "- Applicants must be Australian citizens.",
      ].join("\n"),
      extractedAt: NOW,
    });
    const eligibility = assessJobEligibility(job, himakarCandidateProfile, { assessedAt: NOW });
    const fit = scoreJobFit(job, himakarCandidateProfile, eligibility, { assessedAt: NOW });

    expect(eligibility.decision).toBe("ineligible");
    expect(eligibility.reasons[0].excerpt).toBe("- Applicants must be Australian citizens.");
    expect(fit.deterministicEligibilityDecision).toBe("ineligible");
    expect(fit.recommendation).toBe("DO_NOT_APPLY");
  });
});
