import { z } from "zod";

const groundedTextSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  evidenceClaimIds: z.array(z.string().trim().min(1)).min(1).max(12),
});

const groundedSectionSchema = z.object({
  heading: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().min(1).max(250).optional(),
  bullets: z.array(groundedTextSchema).min(1).max(5),
});

export const groundedApplicationContentSchema = z.object({
  summary: groundedTextSchema,
  skills: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    evidenceClaimIds: z.array(z.string().trim().min(1)).min(1).max(5),
  })).min(4).max(20),
  sections: z.array(groundedSectionSchema).min(2).max(8),
  education: z.array(z.object({
    degree: z.string().trim().min(1).max(250),
    institution: z.string().trim().min(1).max(250),
    period: z.string().trim().min(1).max(80).optional(),
    evidenceClaimIds: z.array(z.string().trim().min(1)).min(1).max(5),
  })).max(4),
  coverLetterParagraphs: z.array(groundedTextSchema).min(3).max(8),
  selectionCriteria: z.array(z.object({
    criterion: z.string().trim().min(1).max(500),
    response: groundedTextSchema,
    confidence: z.number().min(0).max(1),
    factsNeedingConfirmation: z.array(z.string().trim().min(1).max(300)).max(10),
  })).max(20),
});

export type GroundedApplicationContent = z.infer<typeof groundedApplicationContentSchema>;

export function allGroundedStatements(content: GroundedApplicationContent) {
  return [
    content.summary,
    ...content.skills.map((skill) => ({
      text: skill.name,
      evidenceClaimIds: skill.evidenceClaimIds,
    })),
    ...content.sections.flatMap((section) => {
      const evidenceClaimIds = [...new Set(
        section.bullets.flatMap((bullet) => bullet.evidenceClaimIds),
      )];
      return [
        {
          text: `${section.title}${section.subtitle ? `, ${section.subtitle}` : ""}`,
          evidenceClaimIds,
        },
        ...section.bullets,
      ];
    }),
    ...content.education.map((education) => ({
      text: `${education.degree}, ${education.institution}${education.period ? ` (${education.period})` : ""}`,
      evidenceClaimIds: education.evidenceClaimIds,
    })),
    ...content.coverLetterParagraphs,
    ...content.selectionCriteria.map((criterion) => criterion.response),
  ];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/** Ensures model output only selects or reorders exact canonical blocks. */
export function isCanonicalApplicationContentSelection(
  candidate: GroundedApplicationContent,
  canonical: GroundedApplicationContent,
) {
  const subsetOf = (values: unknown[], allowed: unknown[]) => {
    const remaining = new Map<string, number>();
    for (const value of allowed) {
      const key = stableJson(value);
      remaining.set(key, (remaining.get(key) ?? 0) + 1);
    }
    return values.every((value) => {
      const key = stableJson(value);
      const count = remaining.get(key) ?? 0;
      if (count < 1) return false;
      remaining.set(key, count - 1);
      return true;
    });
  };
  const candidateStatements = allGroundedStatements(candidate);
  const canonicalStatements = allGroundedStatements(canonical);
  return stableJson(candidate.summary) === stableJson(canonical.summary)
    && subsetOf(candidateStatements, canonicalStatements)
    && subsetOf(candidate.skills, canonical.skills)
    && subsetOf(candidate.sections, canonical.sections)
    && subsetOf(candidate.education, canonical.education)
    && subsetOf(candidate.coverLetterParagraphs, canonical.coverLetterParagraphs)
    && subsetOf(candidate.selectionCriteria, canonical.selectionCriteria);
}
