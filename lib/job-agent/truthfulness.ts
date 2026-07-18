import {
  truthfulnessAssessmentSchema,
  type CandidateClaim,
  type CandidateProfile,
  type TruthfulnessAssessment,
  type TruthfulnessIssue,
} from "./schemas";

export type GroundedStatement = {
  text: string;
  evidenceClaimIds: string[];
};

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

const NUMBER_WORD = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?";
const QUANTIFIED_UNIT = "(?:clients?|customers?|users?|contracts?|projects?|deployments?|applications?|hours?|days?|weeks?|months?|years?|dollars?)";

function conciseExcerpt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

function canonicalMetric(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => NUMBER_WORDS[word] ?? word)
    .replace(/\baud\b|a\$/g, "$")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function verifiedMetricClaims(profile: CandidateProfile): CandidateClaim[] {
  return profile.claims.filter(
    (claim) => claim.category === "metric"
      && (claim.status === "verified" || claim.status === "user-entered"),
  );
}

function metricMatches(text: string): string[] {
  const patterns: RegExp[] = [
    /(?:AUD|A\$|\$)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:-|–|to)\s*(?:AUD|A\$|\$)?\s*\d[\d,]*(?:\.\d+)?)?/gi,
    /\b\d+(?:\.\d+)?\s*%/g,
    /\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/g,
    /\b\d+(?:\.\d+)?\+?(?:\s+|-)(?:clients?|customers?|users?|contracts?|projects?|deployments?|applications?|hours?|days?|weeks?|months?|years?|dollars?)\b/gi,
    new RegExp(`\\b${NUMBER_WORD}\\+?(?:\\s+|-)${QUANTIFIED_UNIT}\\b`, "gi"),
    new RegExp(`\\b${NUMBER_WORD}\\s+(?:percent|per cent)\\b`, "gi"),
    /\b(?:reduced|increased|improved|saved|grew|generated|delivered)\b[^.!?\n]{0,50}\b\d+(?:\.\d+)?\b/gi,
    new RegExp(`\\b(?:reduced|increased|improved|saved|grew|generated|delivered)\\b[^.!?\\n]{0,50}\\b${NUMBER_WORD}\\b`, "gi"),
  ];
  return [...new Set(patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0])))];
}

function supportedMetric(metric: string, metricClaims: CandidateClaim[]): boolean {
  const normalisedMetric = canonicalMetric(metric);
  return metricClaims.some((claim) => {
    const claimText = canonicalMetric(String(claim.value));
    return claimText.includes(normalisedMetric) || normalisedMetric.includes(claimText);
  });
}

function contradictionIssues(text: string, profile: CandidateProfile): TruthfulnessIssue[] {
  const issues: TruthfulnessIssue[] = [];
  const checks: { contradiction: boolean; pattern: RegExp; message: string }[] = [
    {
      contradiction: !profile.workRights.australianCitizen,
      pattern: /\b(?:I am|I'm|as)\s+(?:an?\s+)?Australian citizen\b/i,
      message: "Generated text claims Australian citizenship, contradicting the verified profile.",
    },
    {
      contradiction: !profile.workRights.australianPermanentResident,
      pattern: /\b(?:I am|I'm|as)\s+(?:an?\s+)?Australian permanent resident\b/i,
      message: "Generated text claims Australian permanent residency, contradicting the verified profile.",
    },
    {
      contradiction: !profile.workRights.securityClearance,
      pattern: /\b(?:I\s+(?:already\s+|currently\s+)?(?:hold|have|possess)|my)\s+(?:an?\s+)?(?:NV1|NV2|baseline|security) clearance\b/i,
      message: "Generated text claims a security clearance not present in verified evidence.",
    },
    {
      contradiction: !profile.licences.australianDriverLicence,
      pattern: /\bI (?:hold|have|possess)\s+(?:an?\s+)?Australian (?:driver'?s?|driving) licen[cs]e\b/i,
      message: "Generated text claims an Australian driver licence, contradicting the verified profile.",
    },
  ];
  for (const check of checks) {
    const match = check.contradiction ? text.match(check.pattern) : null;
    if (match?.[0]) {
      issues.push({
        code: "profile-contradiction",
        message: check.message,
        excerpt: match[0],
        severity: "error",
      });
    }
  }

  const selectedSalary = profile.salaryPreference.selectedAmount;
  if (/(?:AUD|A\$|\$)\s*150,?000\b/i.test(text) && selectedSalary !== 150_000) {
    issues.push({
      code: "profile-contradiction",
      message: "AUD 150,000 must not be inserted unless selected for this opportunity.",
      excerpt: text.match(/(?:AUD|A\$|\$)\s*150,?000\b/i)?.[0] ?? "AUD 150,000",
      severity: "error",
    });
  }
  return issues;
}

/** Checks free-form generated content for prohibited facts and invented metrics. */
export function validateGeneratedText(
  text: string,
  profile: CandidateProfile,
): TruthfulnessAssessment {
  const issues: TruthfulnessIssue[] = contradictionIssues(text, profile);
  const metricClaims = verifiedMetricClaims(profile);
  for (const metric of metricMatches(text)) {
    if (!supportedMetric(metric, metricClaims)) {
      issues.push({
        code: "unsupported-metric",
        message: "A quantified achievement or metric is not supported by a verified metric claim.",
        excerpt: metric,
        severity: "error",
      });
    }
  }
  return truthfulnessAssessmentSchema.parse({ valid: issues.length === 0, issues });
}

/**
 * Validates the evidence references emitted by a resume, cover-letter or
 * selection-criteria generator. Every statement must point to candidate claims.
 */
export function validateGroundedStatements(
  statements: GroundedStatement[],
  profile: CandidateProfile,
): TruthfulnessAssessment {
  const issues: TruthfulnessIssue[] = [];
  const claims = new Map(profile.claims.map((claim) => [claim.id, claim]));

  for (const statement of statements) {
    if (!statement.text.trim()) continue;
    if (statement.evidenceClaimIds.length === 0) {
      issues.push({
        code: "unsupported-claim",
        message: "Generated statement has no candidate evidence reference.",
        excerpt: conciseExcerpt(statement.text),
        severity: "error",
      });
    }

    for (const claimId of statement.evidenceClaimIds) {
      const candidateClaim = claims.get(claimId);
      if (!candidateClaim) {
        issues.push({
          code: "unknown-claim",
          message: `Generated statement references unknown claim ${claimId}.`,
          excerpt: conciseExcerpt(statement.text),
          severity: "error",
        });
      } else if (candidateClaim.status === "prohibited-from-inference") {
        issues.push({
          code: "prohibited-claim",
          message: `Claim ${claimId} is prohibited from inference.`,
          excerpt: conciseExcerpt(statement.text),
          severity: "error",
        });
      } else if (candidateClaim.status === "needs-confirmation") {
        issues.push({
          code: "unconfirmed-claim",
          message: `Claim ${claimId} needs user confirmation before use.`,
          excerpt: conciseExcerpt(statement.text),
          severity: "error",
        });
      }
    }

    issues.push(...validateGeneratedText(statement.text, profile).issues);

    const referencedMetricClaims = statement.evidenceClaimIds
      .map((claimId) => claims.get(claimId))
      .filter((candidateClaim): candidateClaim is CandidateClaim => candidateClaim?.category === "metric")
      .filter((candidateClaim) => candidateClaim.status === "verified" || candidateClaim.status === "user-entered");
    for (const metric of metricMatches(statement.text)) {
      if (!supportedMetric(metric, referencedMetricClaims)) {
        issues.push({
          code: "unsupported-metric",
          message: "A metric must reference its specific verified metric claim.",
          excerpt: metric,
          severity: "error",
        });
      }
    }
  }

  const deduplicated = issues.filter((issue, index, all) =>
    all.findIndex((candidate) =>
      candidate.code === issue.code
      && candidate.excerpt === issue.excerpt
      && candidate.message === issue.message,
    ) === index,
  );
  return truthfulnessAssessmentSchema.parse({
    valid: deduplicated.length === 0,
    issues: deduplicated,
  });
}

export function assertTruthfulStatements(
  statements: GroundedStatement[],
  profile: CandidateProfile,
): void {
  const result = validateGroundedStatements(statements, profile);
  if (!result.valid) {
    throw new Error(`Truthfulness validation failed: ${result.issues.map((item) => item.message).join(" ")}`);
  }
}
