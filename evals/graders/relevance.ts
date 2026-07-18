import { check, includesAll, textContainsAll } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeCoverLetterRelevance(
  testCase: EvalCase,
  execution: EvalExecution,
): GradeCheck[] {
  const expected = testCase.expected.coverLetter;
  if (!expected) return [];

  const text = expected.statements.map((statement) => statement.text).join("\n");
  const checks = [check(
    testCase.id,
    "cover-letter-relevance",
    "mentions all expected job-specific terms",
    textContainsAll(text, expected.relevantTermsAll),
    expected.relevantTermsAll,
    text,
  )];
  const grounding = execution.coverLetterGrounding;
  checks.push(check(
    testCase.id,
    "cover-letter-relevance",
    "keeps cover-letter claims evidence grounded",
    grounding?.valid === expected.valid,
    expected.valid,
    grounding?.valid ?? "assessment was not executed",
  ));
  if (expected.issueCodesAll) {
    const codes = grounding?.issues.map((item) => item.code) ?? [];
    checks.push(check(
      testCase.id,
      "cover-letter-relevance",
      "reports expected cover-letter evidence issues",
      includesAll(codes, expected.issueCodesAll),
      expected.issueCodesAll,
      codes,
    ));
  }
  return checks;
}
