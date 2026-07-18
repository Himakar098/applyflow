import type { GradeCheck } from "./types";

export function check(
  caseId: string,
  category: GradeCheck["category"],
  name: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
): GradeCheck {
  return { caseId, category, name, passed, expected, actual };
}

export function includesAll(actual: string[], expected: string[]): boolean {
  const values = actual.map((item) => item.toLowerCase());
  return expected.every((item) => values.includes(item.toLowerCase()));
}

export function textContainsAll(actual: string, expected: string[]): boolean {
  const text = actual.toLowerCase();
  return expected.every((item) => text.includes(item.toLowerCase()));
}

