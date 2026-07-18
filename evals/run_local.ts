import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  validateGeneratedText,
  validateGroundedStatements,
  type Application,
  type AutofillPlan,
} from "../lib/job-agent";
import {
  gradeApproval,
  gradeCoverLetterRelevance,
  gradeEligibility,
  gradeExtraction,
  gradeFit,
  gradeScoreComparisons,
  gradeTruthfulness,
  gradeVisaAnswer,
  type ApprovalProbe,
  type CaseResult,
  type EvalCase,
  type EvalExecution,
  type GradeCheck,
} from "./graders";

const EVAL_NOW = "2026-07-18T00:00:00.000Z";
const SUBMITTED_AT = "2026-07-18T00:01:00.000Z";
const here = dirname(fileURLToPath(import.meta.url));

function parseCases(source: string): EvalCase[] {
  const cases = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      try {
        return JSON.parse(line) as EvalCase;
      } catch (error) {
        throw new Error(`Invalid JSON on eval case line ${index + 1}: ${(error as Error).message}`);
      }
    });

  const ids = new Set<string>();
  for (const testCase of cases) {
    if (!testCase.id || !testCase.description || !testCase.expected?.eligibility) {
      throw new Error("Every eval case needs an id, description and eligibility expectation.");
    }
    if (ids.has(testCase.id)) throw new Error(`Duplicate eval case id: ${testCase.id}`);
    ids.add(testCase.id);
  }
  return cases;
}

function makeApplication(
  testCase: EvalCase,
  execution: Pick<EvalExecution, "job" | "eligibility" | "fit">,
): Application {
  return applicationSchema.parse({
    id: `eval-application-${testCase.id}`,
    jobId: execution.job.id,
    candidateProfileId: himakarCandidateProfile.id,
    company: execution.job.company.value ?? "Unknown employer",
    role: execution.job.title.value ?? "Unknown role",
    source: "deterministic-eval",
    jobUrl: execution.job.sourceUrl.value,
    applicationUrl: execution.job.applicationUrl.value,
    fitScore: execution.fit.score,
    eligibility: execution.eligibility.decision,
    status: "DRAFT",
    submissionMode: "review_before_submit",
    autofillPlanHash: null,
    dateDiscovered: EVAL_NOW,
    dateApplied: null,
    closingDate: execution.job.closingDate.value,
    createdAt: EVAL_NOW,
    updatedAt: EVAL_NOW,
  });
}

function makePlan(applicationId: string): AutofillPlan {
  return {
    id: `eval-plan-${applicationId}`,
    applicationId,
    fields: [{
      id: "preferred-name",
      label: "Preferred name",
      detectedFieldType: "text",
      proposedValue: himakarCandidateProfile.preferredName,
      source: "candidate.preferredName",
      confidence: 1,
      requiresUserReview: false,
      approved: true,
      sensitive: false,
    }],
    documentUploads: [],
    unknownQuestions: [],
    detectedChallenges: [],
    createdAt: EVAL_NOW,
  };
}

function throws(action: () => unknown): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

function runApprovalProbe(application: Application): ApprovalProbe {
  const plan = makePlan(application.id);
  let readyForReview = transitionApplication(application, "READY_FOR_REVIEW", { now: EVAL_NOW });
  readyForReview = attachAutofillPlan(readyForReview, plan, EVAL_NOW);

  const rejectsAutofillWithoutExplicitApproval = throws(() =>
    approveApplicationForAutofill(readyForReview, false, EVAL_NOW),
  );
  const approvedForAutofill = approveApplicationForAutofill(readyForReview, true, EVAL_NOW);
  const rejectsAutofillWithoutUserInitiation = throws(() =>
    startApprovedAutofill(approvedForAutofill, false, EVAL_NOW),
  );
  const active = startApprovedAutofill(approvedForAutofill, true, EVAL_NOW);
  const readyToSubmit = markApplicationReadyToSubmit(active, plan, EVAL_NOW);
  const rejectsSubmissionWithoutExplicitApproval = throws(() => grantSubmissionApproval({
    approvalId: `eval-approval-${application.id}`,
    application: readyToSubmit,
    plan,
    explicitUserApproval: false,
    grantedBy: himakarCandidateProfile.id,
    grantedAt: EVAL_NOW,
  }));
  const granted = grantSubmissionApproval({
    approvalId: `eval-approval-${application.id}`,
    application: readyToSubmit,
    plan,
    explicitUserApproval: true,
    grantedBy: himakarCandidateProfile.id,
    grantedAt: EVAL_NOW,
  });
  const changedPlan: AutofillPlan = {
    ...plan,
    fields: [{ ...plan.fields[0], proposedValue: "Changed after approval" }],
  };
  const rejectsChangedPlanAfterApproval = throws(() => consumeSubmissionApproval({
    application: granted.application,
    approval: granted.approval,
    plan: changedPlan,
    consumedAt: SUBMITTED_AT,
  }));
  const consumed = consumeSubmissionApproval({
    application: granted.application,
    approval: granted.approval,
    plan,
    consumedAt: SUBMITTED_AT,
  });
  const submitted = recordSuccessfulSubmission({
    application: consumed.application,
    consumedApproval: consumed.approval,
    plan,
    submittedAt: SUBMITTED_AT,
  });
  const rejectsApprovalReuse = throws(() => consumeSubmissionApproval({
    application: granted.application,
    approval: consumed.approval,
    plan,
    consumedAt: SUBMITTED_AT,
  }));

  return {
    rejectsAutofillWithoutExplicitApproval,
    rejectsAutofillWithoutUserInitiation,
    rejectsSubmissionWithoutExplicitApproval,
    rejectsChangedPlanAfterApproval,
    submitsWithExplicitSingleUseApproval:
      submitted.status === "SUBMITTED"
      && consumed.approval.status === "consumed",
    rejectsApprovalReuse,
  };
}

function executeCase(testCase: EvalCase): EvalExecution {
  const job = extractJobDescription({
    id: testCase.id,
    description: testCase.description,
    sourceUrl: testCase.sourceUrl ?? `https://jobs.example.test/${testCase.id}`,
    applicationUrl: testCase.applicationUrl ?? `https://jobs.example.test/${testCase.id}/apply`,
    extractedAt: EVAL_NOW,
  });
  const eligibility = assessJobEligibility(job, himakarCandidateProfile, { assessedAt: EVAL_NOW });
  const fit = scoreJobFit(job, himakarCandidateProfile, eligibility, { assessedAt: EVAL_NOW });
  const partial: Pick<EvalExecution, "job" | "eligibility" | "fit"> = { job, eligibility, fit };
  const application = makeApplication(testCase, partial);

  return {
    ...partial,
    truthfulness: testCase.expected.truthfulness
      ? validateGeneratedText(testCase.expected.truthfulness.text, himakarCandidateProfile)
      : undefined,
    resumeGrounding: testCase.expected.resumeGrounding
      ? validateGroundedStatements(testCase.expected.resumeGrounding.statements, himakarCandidateProfile)
      : undefined,
    coverLetterGrounding: testCase.expected.coverLetter
      ? validateGroundedStatements(testCase.expected.coverLetter.statements, himakarCandidateProfile)
      : undefined,
    insufficientEvidence: testCase.expected.insufficientEvidence
      ? validateGroundedStatements(testCase.expected.insufficientEvidence.statements, himakarCandidateProfile)
      : undefined,
    visaAnswer: testCase.expected.visaAnswer
      ? proposeApplicationAnswer(testCase.expected.visaAnswer.question, himakarCandidateProfile)
      : undefined,
    approval: runApprovalProbe(application),
  };
}

function gradeCase(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  return [
    ...gradeExtraction(testCase, execution),
    ...gradeEligibility(testCase, execution),
    ...gradeFit(testCase, execution),
    ...gradeTruthfulness(testCase, execution),
    ...gradeCoverLetterRelevance(testCase, execution),
    ...gradeVisaAnswer(testCase, execution),
    ...gradeApproval(testCase, execution),
  ];
}

function gradeCoverage(results: CaseResult[]): GradeCheck[] {
  const required: GradeCheck["category"][] = [
    "truthfulness",
    "eligibility",
    "extraction",
    "fit-score",
    "resume-grounding",
    "cover-letter-relevance",
    "visa-answer",
    "approval-gate",
    "insufficient-evidence",
  ];
  const present = new Set(results.flatMap((result) => result.checks.map((item) => item.category)));
  return required.map((category) => ({
    caseId: "suite",
    category: "suite-coverage",
    name: `covers ${category}`,
    passed: present.has(category),
    expected: true,
    actual: present.has(category),
  }));
}

async function main() {
  const casePath = resolve(here, "cases.jsonl");
  const cases = parseCases(await readFile(casePath, "utf8"));
  const results: CaseResult[] = cases.map((testCase) => {
    const execution = executeCase(testCase);
    return { id: testCase.id, checks: gradeCase(testCase, execution), execution };
  });

  const comparisonChecks = gradeScoreComparisons(cases, results);
  for (const comparison of comparisonChecks) {
    results.find((result) => result.id === comparison.caseId)?.checks.push(comparison);
  }
  const coverageChecks = gradeCoverage(results);
  const allChecks = [...results.flatMap((result) => result.checks), ...coverageChecks];
  const failures = allChecks.filter((item) => !item.passed);
  const output = {
    schemaVersion: 1,
    evaluatedAt: EVAL_NOW,
    deterministic: true,
    caseCount: cases.length,
    checkCount: allChecks.length,
    passed: allChecks.length - failures.length,
    failed: failures.length,
    coverage: coverageChecks,
    cases: results.map((result) => ({
      id: result.id,
      score: result.execution.fit.score,
      recommendation: result.execution.fit.recommendation,
      eligibility: result.execution.eligibility.decision,
      checks: result.checks,
    })),
  };

  const resultPath = resolve(here, "results/latest.json");
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  for (const result of results) {
    const failed = result.checks.filter((item) => !item.passed).length;
    console.log(
      `${failed === 0 ? "PASS" : "FAIL"} ${result.id}: eligibility=${result.execution.eligibility.decision} score=${result.execution.fit.score} checks=${result.checks.length - failed}/${result.checks.length}`,
    );
  }
  console.log(`\nEval summary: ${output.passed}/${output.checkCount} checks passed across ${output.caseCount} cases.`);
  console.log(`Result: ${resultPath}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(
        `- ${failure.caseId} [${failure.category}] ${failure.name}: expected ${JSON.stringify(failure.expected)}, received ${JSON.stringify(failure.actual)}`,
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
