import type {
  ApplicationRecommendation,
  EligibilityAssessment,
  FitAssessment,
  GroundedStatement,
  ProposedApplicationAnswer,
  StructuredJob,
  TruthfulnessAssessment,
} from "../../lib/job-agent";

export type ExpectedExtraction = {
  title?: string;
  company?: string;
  locationSource?: "explicit" | "inferred" | "unknown";
  requiredSkillsAll?: string[];
  requirementCategoriesAll?: string[];
  redFlagsContain?: string[];
};

export type ExpectedFit = {
  minimumScore?: number;
  maximumScore?: number;
  recommendation?: ApplicationRecommendation;
  recommendationOneOf?: ApplicationRecommendation[];
  lowerThanCaseId?: string;
  strongMatchesContain?: string[];
  projectEvidenceContain?: string[];
  positioningContains?: string[];
};

export type ExpectedTextAssessment = {
  text: string;
  valid: boolean;
  issueCodesAll?: string[];
};

export type ExpectedGroundingAssessment = {
  statements: GroundedStatement[];
  valid: boolean;
  issueCodesAll?: string[];
};

export type ExpectedCoverLetter = ExpectedGroundingAssessment & {
  relevantTermsAll: string[];
};

export type ExpectedAnswer = {
  question: string;
  classification: ProposedApplicationAnswer["classification"];
  proposedValue: string | null;
  requiresUserConfirmation: boolean;
  autoFillAllowed: boolean;
};

export type EvalCase = {
  id: string;
  description: string;
  sourceUrl?: string;
  applicationUrl?: string;
  expected: {
    extraction: ExpectedExtraction;
    eligibility: {
      decision: EligibilityAssessment["decision"];
      reasonCodesAll?: string[];
    };
    fit: ExpectedFit;
    truthfulness?: ExpectedTextAssessment;
    resumeGrounding?: ExpectedGroundingAssessment;
    coverLetter?: ExpectedCoverLetter;
    visaAnswer?: ExpectedAnswer;
    insufficientEvidence?: ExpectedGroundingAssessment;
  };
};

export type ApprovalProbe = {
  rejectsAutofillWithoutExplicitApproval: boolean;
  rejectsAutofillWithoutUserInitiation: boolean;
  rejectsSubmissionWithoutExplicitApproval: boolean;
  rejectsChangedPlanAfterApproval: boolean;
  submitsWithExplicitSingleUseApproval: boolean;
  rejectsApprovalReuse: boolean;
};

export type EvalExecution = {
  job: StructuredJob;
  eligibility: EligibilityAssessment;
  fit: FitAssessment;
  truthfulness?: TruthfulnessAssessment;
  resumeGrounding?: TruthfulnessAssessment;
  coverLetterGrounding?: TruthfulnessAssessment;
  insufficientEvidence?: TruthfulnessAssessment;
  visaAnswer?: ProposedApplicationAnswer;
  approval: ApprovalProbe;
};

export type GradeCheck = {
  caseId: string;
  category:
    | "truthfulness"
    | "eligibility"
    | "extraction"
    | "fit-score"
    | "resume-grounding"
    | "cover-letter-relevance"
    | "visa-answer"
    | "approval-gate"
    | "insufficient-evidence"
    | "suite-coverage";
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

export type CaseResult = {
  id: string;
  checks: GradeCheck[];
  execution: EvalExecution;
};

