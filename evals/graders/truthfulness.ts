import { check, includesAll } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

function gradeAssessment(
  testCase: EvalCase,
  category: "truthfulness" | "resume-grounding" | "insufficient-evidence",
  label: string,
  expected: { valid: boolean; issueCodesAll?: string[] },
  actual: EvalExecution["truthfulness"],
): GradeCheck[] {
  if (!actual) {
    return [check(testCase.id, category, label, false, expected, "assessment was not executed")];
  }
  const checks = [check(
    testCase.id,
    category,
    label,
    actual.valid === expected.valid,
    expected.valid,
    actual.valid,
  )];
  if (expected.issueCodesAll) {
    const codes = actual.issues.map((item) => item.code);
    checks.push(check(
      testCase.id,
      category,
      `${label} reports expected issues`,
      includesAll(codes, expected.issueCodesAll),
      expected.issueCodesAll,
      codes,
    ));
  }
  return checks;
}

export function gradeTruthfulness(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  const checks: GradeCheck[] = [];
  if (testCase.expected.truthfulness) {
    checks.push(...gradeAssessment(
      testCase,
      "truthfulness",
      "classifies generated text truthfulness",
      testCase.expected.truthfulness,
      execution.truthfulness,
    ));
  }
  if (testCase.expected.resumeGrounding) {
    checks.push(...gradeAssessment(
      testCase,
      "resume-grounding",
      "validates resume evidence references",
      testCase.expected.resumeGrounding,
      execution.resumeGrounding,
    ));
  }
  if (testCase.expected.insufficientEvidence) {
    checks.push(...gradeAssessment(
      testCase,
      "insufficient-evidence",
      "fails closed when evidence is insufficient",
      testCase.expected.insufficientEvidence,
      execution.insufficientEvidence,
    ));
  }
  return checks;
}

