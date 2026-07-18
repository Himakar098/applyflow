import { check, textContainsAll } from "./check";
import type { CaseResult, EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeFit(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  const expected = testCase.expected.fit;
  const maximum = execution.fit.categories.reduce((sum, item) => sum + item.maximum, 0);
  const awarded = Math.round(execution.fit.categories.reduce((sum, item) => sum + item.awarded, 0));
  const checks: GradeCheck[] = [
    check(testCase.id, "fit-score", "category weights total 100", maximum === 100, 100, maximum),
    check(
      testCase.id,
      "fit-score",
      "reported score equals the category total",
      awarded === execution.fit.score,
      awarded,
      execution.fit.score,
    ),
    check(
      testCase.id,
      "fit-score",
      "preserves the deterministic eligibility result",
      execution.fit.deterministicEligibilityDecision === execution.eligibility.decision,
      execution.eligibility.decision,
      execution.fit.deterministicEligibilityDecision,
    ),
  ];

  if (execution.eligibility.decision === "ineligible") {
    checks.push(check(
      testCase.id,
      "fit-score",
      "cannot recommend an ineligible role",
      execution.fit.recommendation === "DO_NOT_APPLY",
      "DO_NOT_APPLY",
      execution.fit.recommendation,
    ));
  }
  if (expected.minimumScore !== undefined) {
    checks.push(check(
      testCase.id,
      "fit-score",
      "meets the minimum expected score",
      execution.fit.score >= expected.minimumScore,
      `>= ${expected.minimumScore}`,
      execution.fit.score,
    ));
  }
  if (expected.maximumScore !== undefined) {
    checks.push(check(
      testCase.id,
      "fit-score",
      "does not exceed the maximum expected score",
      execution.fit.score <= expected.maximumScore,
      `<= ${expected.maximumScore}`,
      execution.fit.score,
    ));
  }
  if (expected.recommendation !== undefined) {
    checks.push(check(
      testCase.id,
      "fit-score",
      "returns the expected recommendation",
      execution.fit.recommendation === expected.recommendation,
      expected.recommendation,
      execution.fit.recommendation,
    ));
  }
  if (expected.recommendationOneOf) {
    checks.push(check(
      testCase.id,
      "fit-score",
      "returns an allowed recommendation",
      expected.recommendationOneOf.includes(execution.fit.recommendation),
      expected.recommendationOneOf,
      execution.fit.recommendation,
    ));
  }
  if (expected.strongMatchesContain) {
    const actual = execution.fit.strongMatches.join("\n");
    checks.push(check(
      testCase.id,
      "fit-score",
      "reports expected strong matches",
      textContainsAll(actual, expected.strongMatchesContain),
      expected.strongMatchesContain,
      execution.fit.strongMatches,
    ));
  }
  if (expected.projectEvidenceContain) {
    const projectEvidence = execution.fit.categories
      .find((item) => item.category === "projectRelevance")
      ?.evidence.join("\n") ?? "";
    checks.push(check(
      testCase.id,
      "fit-score",
      "uses expected project evidence",
      textContainsAll(projectEvidence, expected.projectEvidenceContain),
      expected.projectEvidenceContain,
      projectEvidence,
    ));
  }
  if (expected.positioningContains) {
    checks.push(check(
      testCase.id,
      "fit-score",
      "produces relevant positioning guidance",
      textContainsAll(execution.fit.recommendedPositioning, expected.positioningContains),
      expected.positioningContains,
      execution.fit.recommendedPositioning,
    ));
  }
  return checks;
}

export function gradeScoreComparisons(cases: EvalCase[], results: CaseResult[]): GradeCheck[] {
  const resultById = new Map(results.map((result) => [result.id, result]));
  const checks: GradeCheck[] = [];
  for (const testCase of cases) {
    const referenceId = testCase.expected.fit.lowerThanCaseId;
    if (!referenceId) continue;
    const current = resultById.get(testCase.id);
    const reference = resultById.get(referenceId);
    checks.push(check(
      testCase.id,
      "fit-score",
      `scores lower than ${referenceId}`,
      Boolean(current && reference && current.execution.fit.score < reference.execution.fit.score),
      `score < ${referenceId}`,
      current && reference
        ? `${current.execution.fit.score} < ${reference.execution.fit.score}`
        : "comparison case missing",
    ));
  }
  return checks;
}

