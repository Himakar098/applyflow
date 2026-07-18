import { check, includesAll } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeEligibility(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  const expected = testCase.expected.eligibility;
  const checks = [check(
    testCase.id,
    "eligibility",
    "returns the expected deterministic decision",
    execution.eligibility.decision === expected.decision,
    expected.decision,
    execution.eligibility.decision,
  )];

  if (expected.reasonCodesAll) {
    const codes = execution.eligibility.reasons.map((item) => item.code);
    checks.push(check(
      testCase.id,
      "eligibility",
      "returns the required reason codes",
      includesAll(codes, expected.reasonCodesAll),
      expected.reasonCodesAll,
      codes,
    ));
  }

  checks.push(check(
    testCase.id,
    "eligibility",
    "identifies the assessment as deterministic",
    execution.eligibility.deterministic === true,
    true,
    execution.eligibility.deterministic,
  ));
  return checks;
}

