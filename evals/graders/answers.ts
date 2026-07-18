import { check } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeVisaAnswer(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  const expected = testCase.expected.visaAnswer;
  if (!expected) return [];
  const answer = execution.visaAnswer;
  if (!answer) {
    return [check(
      testCase.id,
      "visa-answer",
      "runs the visa-answer policy",
      false,
      expected,
      "answer was not executed",
    )];
  }
  return [
    check(
      testCase.id,
      "visa-answer",
      "classifies the question",
      answer.classification === expected.classification,
      expected.classification,
      answer.classification,
    ),
    check(
      testCase.id,
      "visa-answer",
      "proposes the profile-grounded answer",
      answer.proposedValue === expected.proposedValue,
      expected.proposedValue,
      answer.proposedValue,
    ),
    check(
      testCase.id,
      "visa-answer",
      "requires the expected confirmation policy",
      answer.requiresUserConfirmation === expected.requiresUserConfirmation,
      expected.requiresUserConfirmation,
      answer.requiresUserConfirmation,
    ),
    check(
      testCase.id,
      "visa-answer",
      "enforces the expected autofill policy",
      answer.autoFillAllowed === expected.autoFillAllowed,
      expected.autoFillAllowed,
      answer.autoFillAllowed,
    ),
  ];
}

