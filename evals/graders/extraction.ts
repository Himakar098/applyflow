import { check, includesAll, textContainsAll } from "./check";
import type { EvalCase, EvalExecution, GradeCheck } from "./types";

export function gradeExtraction(testCase: EvalCase, execution: EvalExecution): GradeCheck[] {
  const expected = testCase.expected.extraction;
  const checks: GradeCheck[] = [];

  if (expected.title !== undefined) {
    checks.push(check(
      testCase.id,
      "extraction",
      "extracts the expected title",
      execution.job.title.value === expected.title,
      expected.title,
      execution.job.title.value,
    ));
  }
  if (expected.company !== undefined) {
    checks.push(check(
      testCase.id,
      "extraction",
      "extracts the expected company",
      execution.job.company.value === expected.company,
      expected.company,
      execution.job.company.value,
    ));
  }
  if (expected.locationSource !== undefined) {
    checks.push(check(
      testCase.id,
      "extraction",
      "records location provenance",
      execution.job.location.source === expected.locationSource,
      expected.locationSource,
      execution.job.location.source,
    ));
  }
  if (expected.requiredSkillsAll) {
    checks.push(check(
      testCase.id,
      "extraction",
      "extracts all required skills",
      includesAll(execution.job.requiredSkills.value, expected.requiredSkillsAll),
      expected.requiredSkillsAll,
      execution.job.requiredSkills.value,
    ));
  }
  if (expected.requirementCategoriesAll) {
    const categories = execution.job.requirements.map((item) => item.category);
    checks.push(check(
      testCase.id,
      "extraction",
      "classifies requirement categories",
      includesAll(categories, expected.requirementCategoriesAll),
      expected.requirementCategoriesAll,
      categories,
    ));
  }
  if (expected.redFlagsContain) {
    const redFlags = execution.job.potentialRedFlags.value.join("\n");
    checks.push(check(
      testCase.id,
      "extraction",
      "surfaces expected red flags",
      textContainsAll(redFlags, expected.redFlagsContain),
      expected.redFlagsContain,
      execution.job.potentialRedFlags.value,
    ));
  }

  return checks;
}

