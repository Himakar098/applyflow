import { z } from "zod";

// Runtime schemas are the trust boundary for model output and persisted records.

export const claimStatusSchema = z.enum([
  "verified",
  "user-entered",
  "needs-confirmation",
  "prohibited-from-inference",
]);

export const claimCategorySchema = z.enum([
  "personal",
  "location",
  "work-rights",
  "availability",
  "licence",
  "salary",
  "education",
  "employment",
  "project",
  "skill",
  "certification",
  "link",
  "application-answer",
  "preference",
  "metric",
]);

export const claimValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const candidateClaimSchema = z.object({
  id: z.string().min(1),
  category: claimCategorySchema,
  field: z.string().min(1),
  value: claimValueSchema,
  status: claimStatusSchema,
  source: z.string().min(1),
  evidence: z.string().min(1).optional(),
  sensitive: z.boolean().default(false),
  lastConfirmedAt: z.string().min(1).optional(),
});

const dateRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1).nullable(),
});

export const educationSchema = z.object({
  id: z.string().min(1),
  qualification: z.string().min(1),
  institution: z.string().min(1),
  period: dateRangeSchema,
  details: z.array(z.string()),
  claimIds: z.array(z.string().min(1)).min(1),
});

export const employmentSchema = z.object({
  id: z.string().min(1),
  employer: z.string().min(1),
  role: z.string().min(1),
  period: dateRangeSchema,
  current: z.boolean(),
  highlights: z.array(z.string()).min(1),
  claimIds: z.array(z.string().min(1)).min(1),
});

export const candidateProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  organisation: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  highlights: z.array(z.string()).min(1),
  technologies: z.array(z.string()),
  claimIds: z.array(z.string().min(1)).min(1),
});

export const salaryPreferenceSchema = z.object({
  currency: z.literal("AUD"),
  minimum: z.number().nonnegative(),
  maximum: z.number().nonnegative(),
  period: z.literal("annual"),
  plusSuper: z.boolean(),
  selectedAmount: z.number().nonnegative().nullable(),
  requiresPerOpportunityConfirmation: z.literal(true),
  claimId: z.string().min(1),
}).refine((salary) => salary.maximum >= salary.minimum, {
  message: "Salary maximum must not be below the minimum.",
  path: ["maximum"],
});

export const candidateProfileSchema = z.object({
  id: z.string().min(1),
  preferredName: z.string().min(1),
  location: z.object({
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.literal("Australia"),
    preferredWorkLocations: z.array(z.string()).min(1),
  }),
  privateContactReferences: z.object({
    emailEnvVar: z.string().min(1),
    phoneEnvVar: z.string().min(1),
    addressEnvVar: z.string().min(1),
  }),
  workRights: z.object({
    visa: z.string().min(1),
    visaSubclass: z.string().min(1),
    fullWorkingRights: z.boolean(),
    australianCitizen: z.boolean(),
    australianPermanentResident: z.boolean(),
    securityClearance: z.string().min(1).nullable(),
    sponsorshipAnswer: z.string().min(1).nullable(),
    claimIds: z.array(z.string().min(1)).min(1),
  }),
  availability: z.object({
    fullTime: z.boolean(),
    noticePeriod: z.string().min(1).nullable(),
    claimIds: z.array(z.string().min(1)).min(1),
  }),
  licences: z.object({
    australianDriverLicence: z.boolean(),
    internationalDriverLicence: z.boolean().nullable(),
    claimIds: z.array(z.string().min(1)).min(1),
  }),
  salaryPreference: salaryPreferenceSchema,
  education: z.array(educationSchema),
  employment: z.array(employmentSchema),
  projects: z.array(candidateProjectSchema),
  skills: z.array(z.string().min(1)).min(1),
  preferredRoles: z.array(z.string().min(1)).min(1),
  excludedRequirements: z.array(z.string().min(1)),
  claims: z.array(candidateClaimSchema).min(1),
  updatedAt: z.string().min(1),
}).superRefine((profile, ctx) => {
  const ids = new Set<string>();
  for (const claim of profile.claims) {
    if (ids.has(claim.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate claim id: ${claim.id}`,
        path: ["claims"],
      });
    }
    ids.add(claim.id);
  }

  const references = [
    ...profile.workRights.claimIds,
    ...profile.availability.claimIds,
    ...profile.licences.claimIds,
    profile.salaryPreference.claimId,
    ...profile.education.flatMap((item) => item.claimIds),
    ...profile.employment.flatMap((item) => item.claimIds),
    ...profile.projects.flatMap((item) => item.claimIds),
  ];
  for (const claimId of references) {
    if (!ids.has(claimId)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown claim reference: ${claimId}`,
        path: ["claims"],
      });
    }
  }
});

export const extractionSourceSchema = z.enum(["explicit", "inferred", "unknown"]);

export const extractedTextSchema = z.object({
  value: z.string().nullable(),
  source: extractionSourceSchema,
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const extractedStringListSchema = z.object({
  value: z.array(z.string()),
  source: extractionSourceSchema,
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const extractedWorkArrangementSchema = z.object({
  value: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  source: extractionSourceSchema,
  excerpts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const jobRequirementSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "skill",
    "experience",
    "education",
    "work-rights",
    "citizenship",
    "permanent-residency",
    "security-clearance",
    "driver-licence",
    "professional-registration",
    "location",
    "other",
  ]),
  text: z.string().min(1),
  importance: z.enum(["required", "preferred", "ambiguous"]),
  source: extractionSourceSchema,
  excerpt: z.string().min(1),
});

export const structuredJobSchema = z.object({
  id: z.string().min(1),
  originalDescription: z.string().min(1),
  company: extractedTextSchema,
  title: extractedTextSchema,
  location: extractedTextSchema,
  workArrangement: extractedWorkArrangementSchema,
  employmentType: extractedTextSchema,
  salary: extractedTextSchema,
  datePosted: extractedTextSchema,
  closingDate: extractedTextSchema,
  sourceUrl: extractedTextSchema,
  applicationUrl: extractedTextSchema,
  responsibilities: extractedStringListSchema,
  requiredSkills: extractedStringListSchema,
  preferredSkills: extractedStringListSchema,
  requiredExperience: extractedStringListSchema,
  educationRequirements: extractedStringListSchema,
  visaRequirements: extractedStringListSchema,
  citizenshipRequirements: extractedStringListSchema,
  securityClearanceRequirements: extractedStringListSchema,
  driverLicenceRequirements: extractedStringListSchema,
  industry: extractedTextSchema,
  seniority: extractedTextSchema,
  technologyStack: extractedStringListSchema,
  selectionCriteria: extractedStringListSchema,
  applicationQuestions: extractedStringListSchema,
  potentialRedFlags: extractedStringListSchema,
  requirements: z.array(jobRequirementSchema),
  extractedAt: z.string().min(1),
});

export const eligibilityDecisionSchema = z.enum([
  "eligible",
  "ineligible",
  "needs_review",
]);

export const eligibilityReasonSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  excerpt: z.string().min(1),
  blocking: z.boolean(),
});

export const eligibilityAssessmentSchema = z.object({
  jobId: z.string().min(1),
  candidateProfileId: z.string().min(1),
  decision: eligibilityDecisionSchema,
  reasons: z.array(eligibilityReasonSchema),
  assessedAt: z.string().min(1),
  deterministic: z.literal(true),
});

export const fitCategoryNameSchema = z.enum([
  "technicalSkills",
  "relevantExperience",
  "projectRelevance",
  "education",
  "roleSeniority",
  "industryTransferability",
  "locationAndWorkArrangement",
  "workRightEligibility",
]);

export const fitCategoryScoreSchema = z.object({
  category: fitCategoryNameSchema,
  awarded: z.number().min(0),
  maximum: z.number().positive(),
  rationale: z.string().min(1),
  evidence: z.array(z.string()),
}).refine((score) => score.awarded <= score.maximum, {
  message: "Awarded score cannot exceed category maximum.",
  path: ["awarded"],
});

export const applicationRecommendationSchema = z.enum([
  "APPLY_NOW",
  "APPLY_WITH_TAILORING",
  "REVIEW_FIRST",
  "LOW_PRIORITY",
  "DO_NOT_APPLY",
]);

export const fitAssessmentSchema = z.object({
  jobId: z.string().min(1),
  candidateProfileId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  categories: z.array(fitCategoryScoreSchema).length(8),
  strongMatches: z.array(z.string()),
  transferableStrengths: z.array(z.string()),
  missingMandatoryRequirements: z.array(z.string()),
  missingPreferredRequirements: z.array(z.string()),
  likelyInterviewConcerns: z.array(z.string()),
  recommendedPositioning: z.string().min(1),
  recommendation: applicationRecommendationSchema,
  assessedAt: z.string().min(1),
  deterministicEligibilityDecision: eligibilityDecisionSchema,
}).superRefine((assessment, ctx) => {
  const maximum = assessment.categories.reduce((sum, item) => sum + item.maximum, 0);
  const awarded = Math.round(
    assessment.categories.reduce((sum, item) => sum + item.awarded, 0),
  );
  if (maximum !== 100) {
    ctx.addIssue({ code: "custom", message: "Fit category weights must total 100.", path: ["categories"] });
  }
  if (awarded !== assessment.score) {
    ctx.addIssue({ code: "custom", message: "Fit score must equal the rounded category total.", path: ["score"] });
  }
  if (
    assessment.deterministicEligibilityDecision === "ineligible"
    && assessment.recommendation !== "DO_NOT_APPLY"
  ) {
    ctx.addIssue({
      code: "custom",
      message: "An ineligible job must always have a DO_NOT_APPLY recommendation.",
      path: ["recommendation"],
    });
  }
});

export const applicationStateSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED_FOR_AUTOFILL",
  "AUTOFILL_IN_PROGRESS",
  "AUTOFILL_PAUSED",
  "READY_TO_SUBMIT",
  "SUBMISSION_APPROVED",
  "SUBMITTED",
  "FAILED",
  "WITHDRAWN",
]);

export const applicationSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  candidateProfileId: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  source: z.string().min(1),
  jobUrl: z.string().url().nullable(),
  applicationUrl: z.string().url().nullable(),
  fitScore: z.number().int().min(0).max(100),
  eligibility: eligibilityDecisionSchema,
  status: applicationStateSchema,
  submissionMode: z.literal("review_before_submit"),
  autofillPlanHash: z.string().min(1).nullable(),
  dateDiscovered: z.string().min(1),
  dateApplied: z.string().min(1).nullable(),
  closingDate: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const autofillFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detectedFieldType: z.string().min(1),
  proposedValue: z.string(),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiresUserReview: z.boolean(),
  approved: z.boolean(),
  sensitive: z.boolean(),
});

export const autofillPlanSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  fields: z.array(autofillFieldSchema),
  documentUploads: z.array(z.object({
    fieldLabel: z.string().min(1),
    documentId: z.string().min(1),
    approved: z.boolean(),
  })),
  unknownQuestions: z.array(z.string()),
  detectedChallenges: z.array(z.enum([
    "captcha",
    "mfa",
    "bot-detection",
    "legal-declaration",
    "identity-declaration",
    "sensitive-demographic",
  ])),
  createdAt: z.string().min(1),
});

export const approvalSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  action: z.literal("final_submission"),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["granted", "consumed", "revoked", "expired"]),
  grantedBy: z.string().min(1),
  grantedAt: z.string().min(1),
  expiresAt: z.string().min(1).nullable(),
  consumedAt: z.string().min(1).nullable(),
});

export const answerClassificationSchema = z.enum([
  "citizenship",
  "permanent-residency",
  "visa",
  "work-rights",
  "sponsorship",
  "security-clearance",
  "australian-driver-licence",
  "salary",
  "notice-period",
  "sensitive-demographic",
  "legal-declaration",
  "general",
]);

export const proposedApplicationAnswerSchema = z.object({
  question: z.string().min(1),
  classification: answerClassificationSchema,
  proposedValue: z.string().nullable(),
  sourceClaimIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  requiresUserConfirmation: z.boolean(),
  autoFillAllowed: z.boolean(),
  pauseReason: z.string().nullable(),
});

export const truthfulnessIssueSchema = z.object({
  code: z.enum([
    "unsupported-claim",
    "unknown-claim",
    "unconfirmed-claim",
    "prohibited-claim",
    "unsupported-metric",
    "profile-contradiction",
  ]),
  message: z.string().min(1),
  excerpt: z.string().min(1),
  severity: z.enum(["error", "warning"]),
});

export const truthfulnessAssessmentSchema = z.object({
  valid: z.boolean(),
  issues: z.array(truthfulnessIssueSchema),
});

export const auditEventTypeSchema = z.enum([
  "job_captured",
  "job_parsed",
  "eligibility_decided",
  "fit_scored",
  "documents_generated",
  "documents_edited",
  "browser_session_started",
  "field_filled",
  "answer_changed",
  "user_approval_granted",
  "submission_attempted",
  "submission_result",
]);

export const auditEventSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1).nullable(),
  type: auditEventTypeSchema,
  actorId: z.string().min(1),
  occurredAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export type CandidateClaim = z.infer<typeof candidateClaimSchema>;
export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type StructuredJob = z.infer<typeof structuredJobSchema>;
export type JobRequirement = z.infer<typeof jobRequirementSchema>;
export type EligibilityAssessment = z.infer<typeof eligibilityAssessmentSchema>;
export type FitAssessment = z.infer<typeof fitAssessmentSchema>;
export type ApplicationRecommendation = z.infer<typeof applicationRecommendationSchema>;
export type ApplicationState = z.infer<typeof applicationStateSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type AutofillField = z.infer<typeof autofillFieldSchema>;
export type AutofillPlan = z.infer<typeof autofillPlanSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ProposedApplicationAnswer = z.infer<typeof proposedApplicationAnswerSchema>;
export type TruthfulnessIssue = z.infer<typeof truthfulnessIssueSchema>;
export type TruthfulnessAssessment = z.infer<typeof truthfulnessAssessmentSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
