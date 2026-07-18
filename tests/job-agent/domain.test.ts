import { describe, expect, it } from "vitest";
import {
  applicationSchema,
  assessJobEligibility,
  attachAutofillPlan,
  approveApplicationForAutofill,
  consumeSubmissionApproval,
  createAuditEvent,
  detectDuplicateApplication,
  extractJobDescription,
  grantSubmissionApproval,
  himakarCandidateProfile,
  markApplicationReadyToSubmit,
  pauseForDetectedChallenge,
  proposeApplicationAnswer,
  recordSuccessfulSubmission,
  scoreJobFit,
  startApprovedAutofill,
  transitionApplication,
  validateGeneratedText,
  validateGroundedStatements,
  type Application,
  type AutofillPlan,
  type StructuredJob,
} from "../../lib/job-agent";

const NOW = "2026-07-18T04:00:00.000Z";

function job(description: string, id = "job-1"): StructuredJob {
  return extractJobDescription({
    id,
    description,
    sourceUrl: `https://careers.example.com/jobs/${id}`,
    applicationUrl: `https://careers.example.com/jobs/${id}/apply`,
    extractedAt: NOW,
  });
}

function application(status: Application["status"] = "DRAFT"): Application {
  return applicationSchema.parse({
    id: "application-1",
    jobId: "job-1",
    candidateProfileId: himakarCandidateProfile.id,
    company: "Example Company",
    role: "Data Analyst",
    source: "manual",
    jobUrl: "https://careers.example.com/jobs/job-1",
    applicationUrl: "https://careers.example.com/jobs/job-1/apply",
    fitScore: 85,
    eligibility: "eligible",
    status,
    submissionMode: "review_before_submit",
    autofillPlanHash: null,
    dateDiscovered: NOW,
    dateApplied: null,
    closingDate: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function autofillPlan(overrides: Partial<AutofillPlan> = {}): AutofillPlan {
  return {
    id: "plan-1",
    applicationId: "application-1",
    fields: [
      {
        id: "field-1",
        label: "Preferred name",
        detectedFieldType: "text",
        proposedValue: "Himakar",
        source: "preferred-name",
        confidence: 1,
        requiresUserReview: false,
        approved: true,
        sensitive: false,
      },
    ],
    documentUploads: [],
    unknownQuestions: [],
    detectedChallenges: [],
    createdAt: NOW,
    ...overrides,
  };
}

function activeAutofill(plan = autofillPlan()): Application {
  let current = transitionApplication(application(), "READY_FOR_REVIEW", { now: NOW });
  current = attachAutofillPlan(current, plan, NOW);
  current = approveApplicationForAutofill(current, true, NOW);
  return startApprovedAutofill(current, true, NOW);
}

describe("job extraction provenance", () => {
  it("preserves the original description and marks explicit and inferred fields", () => {
    const description = [
      "Junior Data Analyst",
      "Example Analytics",
      "Location: Perth, WA",
      "Hybrid full-time role",
      "Requirements:",
      "- SQL and Python are required.",
    ].join("\n");
    const parsed = job(description);

    expect(parsed.originalDescription).toBe(description);
    expect(parsed.location.source).toBe("explicit");
    expect(parsed.location.excerpts).toEqual(["Location: Perth, WA"]);
    expect(parsed.title.source).toBe("inferred");
    expect(parsed.title.excerpts).toEqual(["Junior Data Analyst"]);
    expect(parsed.requiredSkills.value).toEqual(expect.arrayContaining(["SQL", "Python"]));
  });
});

describe("deterministic eligibility gate", () => {
  it("rejects an Australian-citizenship-required role with the exact excerpt", () => {
    const parsed = job([
      "Title: Graduate AI Engineer",
      "Company: Defence Example",
      "Requirements:",
      "- Applicants must be Australian citizens.",
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("ineligible");
    expect(result.reasons[0]).toMatchObject({
      code: "AUSTRALIAN_CITIZENSHIP_REQUIRED",
      excerpt: "- Applicants must be Australian citizens.",
      blocking: true,
    });
  });

  it("rejects an Australian-permanent-residency-required role", () => {
    const parsed = job([
      "Title: Data Analyst",
      "Company: Example",
      "Requirements:",
      "- Australian permanent residency is mandatory.",
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("ineligible");
    expect(result.reasons.some((item) => item.code === "AUSTRALIAN_PERMANENT_RESIDENCY_REQUIRED")).toBe(true);
  });

  it("keeps an explicitly temporary-visa-friendly role eligible", () => {
    const parsed = job([
      "Title: Graduate Data Scientist",
      "Company: Example",
      "Location: Perth",
      "Requirements:",
      "- Candidates must have full working rights in Australia.",
      "- Temporary visa holders are welcome.",
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("eligible");
    expect(result.reasons.every((item) => item.blocking === false)).toBe(true);
  });

  it("does not reject a citizen-or-valid-visa alternative", () => {
    const parsed = job([
      "Title: Graduate Software Engineer",
      "Company: Example",
      "Requirements:",
      "- Applicants must be Australian citizens, permanent residents, or valid visa holders.",
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("eligible");
    expect(result.reasons.some((item) => item.blocking)).toBe(false);
  });

  it("marks ambiguous work-right wording as needs_review", () => {
    const parsed = job([
      "Title: Junior AI Engineer",
      "Company: Example",
      "Requirements:",
      "- Applicants must have unrestricted Australian work rights.",
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("needs_review");
    expect(result.reasons[0]).toMatchObject({
      code: "WORK_RIGHTS_WORDING_AMBIGUOUS",
      excerpt: "- Applicants must have unrestricted Australian work rights.",
    });
  });

  it.each([
    ["NV1 security clearance is mandatory.", "UNAVAILABLE_SECURITY_CLEARANCE_REQUIRED"],
    ["An Australian driver's licence is essential.", "AUSTRALIAN_DRIVER_LICENCE_REQUIRED"],
    ["Current AHPRA professional registration is mandatory.", "MISSING_MANDATORY_REGISTRATION"],
    ["A PhD in machine learning is required.", "MISSING_MANDATORY_QUALIFICATION"],
  ])("rejects a verified hard mismatch: %s", (requirement, expectedCode) => {
    const parsed = job([
      "Title: Technical Specialist",
      "Company: Example",
      "Requirements:",
      `- ${requirement}`,
    ].join("\n"));
    const result = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });

    expect(result.decision).toBe("ineligible");
    expect(result.reasons.some((item) => item.code === expectedCode)).toBe(true);
  });

  it("does not allow scoring to override a deterministic eligibility failure", () => {
    const parsed = job([
      "Title: Graduate AI Engineer",
      "Company: Example",
      "Location: Perth",
      "Requirements:",
      "- Python, TypeScript and machine learning are required.",
      "- Applicants must be Australian citizens.",
    ].join("\n"));
    const eligibility = assessJobEligibility(parsed, himakarCandidateProfile, { assessedAt: NOW });
    const fit = scoreJobFit(parsed, himakarCandidateProfile, eligibility, { assessedAt: NOW });

    expect(fit.deterministicEligibilityDecision).toBe("ineligible");
    expect(fit.recommendation).toBe("DO_NOT_APPLY");
  });
});

describe("transparent weighted fit scoring", () => {
  it("scores a senior role lower because of experience and seniority mismatch", () => {
    const junior = job([
      "Title: Junior Data Scientist",
      "Company: Analytics Co",
      "Location: Perth",
      "Requirements:",
      "- Python, SQL and machine learning are required.",
      "- Full working rights in Australia are required.",
    ].join("\n"), "junior-job");
    const senior = job([
      "Title: Senior Data Scientist",
      "Company: Analytics Co",
      "Location: Perth",
      "Requirements:",
      "- Python, SQL and machine learning are required.",
      "- At least 7+ years of data-science experience is required.",
      "- Full working rights in Australia are required.",
    ].join("\n"), "senior-job");
    const juniorFit = scoreJobFit(
      junior,
      himakarCandidateProfile,
      assessJobEligibility(junior, himakarCandidateProfile),
    );
    const seniorFit = scoreJobFit(
      senior,
      himakarCandidateProfile,
      assessJobEligibility(senior, himakarCandidateProfile),
    );

    expect(seniorFit.score).toBeLessThan(juniorFit.score);
    expect(seniorFit.categories.find((item) => item.category === "roleSeniority")?.awarded).toBe(2);
    expect(seniorFit.likelyInterviewConcerns.join(" ")).toContain("7+ years");
  });

  it("scores a strong Perth data analyst role highly using all required weights", () => {
    const parsed = job([
      "Title: Junior Data Analyst",
      "Company: Health Analytics Co",
      "Location: Perth, WA",
      "Employment type: Full-time",
      "Requirements:",
      "- Python and SQL are required.",
      "- A degree in data, analytics, engineering or a related field is required.",
      "- Full working rights in Australia are required.",
      "Responsibilities:",
      "- Automate reporting and build dashboards.",
      "- Produce data summaries and actionable insights.",
    ].join("\n"), "analyst-job");
    const eligibility = assessJobEligibility(parsed, himakarCandidateProfile);
    const fit = scoreJobFit(parsed, himakarCandidateProfile, eligibility);

    expect(fit.score).toBeGreaterThanOrEqual(80);
    expect(fit.categories).toHaveLength(8);
    expect(fit.categories.reduce((sum, item) => sum + item.maximum, 0)).toBe(100);
    expect(fit.strongMatches).toContain("Master of Data Science");
  });

  it("recognises Liquid Audit and speech-agent relevance for an AI role", () => {
    const parsed = job([
      "Title: Applied AI Engineer",
      "Company: AI Products Co",
      "Location: Hybrid Perth",
      "Requirements:",
      "- Python, machine learning, natural language processing and WebSockets are required.",
      "- Full working rights in Australia are required.",
      "Responsibilities:",
      "- Deliver production AI prototypes with users and stakeholders.",
    ].join("\n"), "ai-job");
    const fit = scoreJobFit(
      parsed,
      himakarCandidateProfile,
      assessJobEligibility(parsed, himakarCandidateProfile),
    );
    const projectScore = fit.categories.find((item) => item.category === "projectRelevance");

    expect(projectScore?.awarded).toBe(15);
    expect(projectScore?.evidence).toEqual(expect.arrayContaining([
      "The Liquid Audit",
      "Speech-to-speech meeting agent",
    ]));
    expect(fit.recommendedPositioning).toContain("Norwood");
  });
});

describe("truthful answer and content controls", () => {
  it("blocks invented resume metrics", () => {
    const result = validateGroundedStatements([
      {
        text: "Built The Liquid Audit and reduced costs by 37% across 18 clients.",
        evidenceClaimIds: ["project-liquid-audit-claim"],
      },
    ], himakarCandidateProfile);

    expect(result.valid).toBe(false);
    expect(result.issues.filter((item) => item.code === "unsupported-metric").length).toBeGreaterThan(0);
  });

  it("blocks unsupported number-word experience durations", () => {
    const result = validateGeneratedText(
      "I have seven years of data-science experience and improved accuracy by twenty-five percent.",
      himakarCandidateProfile,
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unsupported-metric", excerpt: "seven years" }),
      expect.objectContaining({ code: "unsupported-metric", excerpt: "twenty-five percent" }),
    ]));
  });

  it("allows the explicitly verified GPA metric", () => {
    const result = validateGroundedStatements([
      {
        text: "Completed the Bachelor of Technology with a GPA of 8.34/10.",
        evidenceClaimIds: ["education-lpu-btech-claim", "metric-btech-gpa"],
      },
    ], himakarCandidateProfile);

    expect(result.valid).toBe(true);
  });

  it("detects prohibited profile contradictions", () => {
    const result = validateGeneratedText(
      "I am an Australian citizen and I hold an Australian driver's licence.",
      himakarCandidateProfile,
    );

    expect(result.valid).toBe(false);
    expect(result.issues.filter((item) => item.code === "profile-contradiction")).toHaveLength(2);
  });

  it("never guesses sponsorship and truthfully answers identity questions", () => {
    const sponsorship = proposeApplicationAnswer("Will you require sponsorship now or in future?", himakarCandidateProfile);
    const citizenship = proposeApplicationAnswer("Are you an Australian citizen?", himakarCandidateProfile);

    expect(sponsorship.proposedValue).toBeNull();
    expect(sponsorship.autoFillAllowed).toBe(false);
    expect(citizenship.proposedValue).toBe("No");
    expect(citizenship.requiresUserConfirmation).toBe(true);
  });

  it("does not automatically answer sensitive demographic questions", () => {
    const proposed = proposeApplicationAnswer(
      "Do you identify as Aboriginal or Torres Strait Islander?",
      himakarCandidateProfile,
    );

    expect(proposed.classification).toBe("sensitive-demographic");
    expect(proposed.proposedValue).toBe("Prefer not to say");
    expect(proposed.autoFillAllowed).toBe(false);
    expect(proposed.requiresUserConfirmation).toBe(true);
  });

  it("pauses for an unknown legal declaration", () => {
    const proposed = proposeApplicationAnswer(
      "I declare and certify that all portal terms are accepted",
      himakarCandidateProfile,
    );

    expect(proposed.classification).toBe("legal-declaration");
    expect(proposed.proposedValue).toBeNull();
    expect(proposed.pauseReason).toContain("legal declaration");
  });
});

describe("application approval state machine", () => {
  it("cannot start autofill without a user-initiated action", () => {
    const plan = autofillPlan();
    let current = transitionApplication(application(), "READY_FOR_REVIEW", { now: NOW });
    current = attachAutofillPlan(current, plan, NOW);
    current = approveApplicationForAutofill(current, true, NOW);

    expect(() => startApprovedAutofill(current, false, NOW)).toThrow(/user-initiated/i);
    expect(startApprovedAutofill(current, true, NOW).status).toBe("AUTOFILL_IN_PROGRESS");
  });

  it("cannot approve or execute final submission without explicit per-application approval", () => {
    const plan = autofillPlan();
    const ready = markApplicationReadyToSubmit(activeAutofill(plan), plan, NOW);

    expect(() => grantSubmissionApproval({
      approvalId: "approval-1",
      application: ready,
      plan,
      explicitUserApproval: false,
      grantedBy: "candidate-himakar-seed",
      grantedAt: NOW,
    })).toThrow(/explicit per-application/i);
    expect(() => transitionApplication(ready, "SUBMISSION_APPROVED", { now: NOW })).toThrow(/granted approval/i);
  });

  it("binds final approval to one plan hash and consumes it once", () => {
    const plan = autofillPlan();
    const ready = markApplicationReadyToSubmit(activeAutofill(plan), plan, NOW);
    const granted = grantSubmissionApproval({
      approvalId: "approval-1",
      application: ready,
      plan,
      explicitUserApproval: true,
      grantedBy: "candidate-himakar-seed",
      grantedAt: NOW,
    });

    const changedPlan = autofillPlan({
      fields: [{ ...plan.fields[0], proposedValue: "Changed after review" }],
    });
    expect(() => consumeSubmissionApproval({
      application: granted.application,
      approval: granted.approval,
      plan: changedPlan,
      consumedAt: "2026-07-18T04:01:00.000Z",
    })).toThrow(/invalid for the current application plan/i);

    const consumed = consumeSubmissionApproval({
      application: granted.application,
      approval: granted.approval,
      plan,
      consumedAt: "2026-07-18T04:01:00.000Z",
    });
    expect(consumed.application.status).toBe("SUBMISSION_APPROVED");
    expect(consumed.approval.status).toBe("consumed");
    expect(() => consumeSubmissionApproval({
      application: granted.application,
      approval: consumed.approval,
      plan,
      consumedAt: "2026-07-18T04:02:00.000Z",
    })).toThrow(/already been consumed/i);
    const submitted = recordSuccessfulSubmission({
      application: consumed.application,
      consumedApproval: consumed.approval,
      plan,
      submittedAt: "2026-07-18T04:03:00.000Z",
    });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.dateApplied).toBe("2026-07-18T04:03:00.000Z");
  });

  it("pauses an active browser session when a CAPTCHA is detected", () => {
    const plan = autofillPlan({ detectedChallenges: ["captcha"] });
    const active = activeAutofill(plan);
    const paused = pauseForDetectedChallenge(active, plan, NOW);

    expect(paused.application.status).toBe("AUTOFILL_PAUSED");
    expect(paused.reasons).toContain("Detected captcha");
    expect(() => markApplicationReadyToSubmit(active, plan, NOW)).toThrow(/browser challenges/i);
  });
});

describe("duplicates and redacted audit logging", () => {
  it("detects duplicate applications despite tracking parameters", () => {
    const parsed = job([
      "Title: Data Analyst",
      "Company: Example Company Pty Ltd",
      "Location: Perth",
    ].join("\n"));
    parsed.applicationUrl.value = "https://careers.example.com/jobs/job-1/apply?utm_source=linkedin";
    const existing = application("SUBMITTED");

    const result = detectDuplicateApplication(parsed, [existing]);
    expect(result).toMatchObject({
      duplicate: true,
      matchedApplicationId: "application-1",
      reason: "same-application-url",
    });
  });

  it("redacts secret keys and secret-shaped values without mutating safe fields", () => {
    const event = createAuditEvent({
      id: "audit-1",
      applicationId: "application-1",
      type: "submission_attempted",
      actorId: "candidate-himakar-seed",
      occurredAt: NOW,
      metadata: {
        company: "Example Company",
        apiKey: "sk-example-do-not-log-123456789",
        headers: { authorization: "Bearer secret-token-value" },
        note: "accidentally included sk-another-secret-123456789",
      },
    });

    expect(event.metadata.company).toBe("Example Company");
    expect(event.metadata.apiKey).toBe("[REDACTED]");
    expect((event.metadata.headers as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect(event.metadata.note).not.toContain("sk-another-secret");
  });
});
