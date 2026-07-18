import { check } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeApproval(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  return Object.entries(execution.approval).map(([name, actual]) => check(
    testCase.id,
    "approval-gate",
    name,
    actual === true,
    true,
    actual,
  ));
}

