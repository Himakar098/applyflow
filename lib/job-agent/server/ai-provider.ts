import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { HttpError } from "@/lib/auth/verify-id-token";
import {
  groundedApplicationContentSchema,
  isCanonicalApplicationContentSelection,
  type GroundedApplicationContent,
} from "@/lib/job-agent/server/generated-documents";

type Claim = {
  id: string;
  category: string;
  status: string;
};

type CandidateForGeneration = {
  preferredName: string;
  location: { city: string; state: string; country: string };
  workRights: {
    visa: string;
    visaSubclass: string;
    fullWorkingRights: boolean;
    claimIds: string[];
  };
  education: Array<{
    qualification: string;
    institution: string;
    period: { start: string; end: string | null };
    details: string[];
    claimIds: string[];
  }>;
  employment: Array<{
    employer: string;
    role: string;
    period: { start: string; end: string | null };
    highlights: string[];
    claimIds: string[];
  }>;
  projects: Array<{
    name: string;
    type: string;
    organisation?: string;
    highlights: string[];
    technologies: string[];
    claimIds: string[];
  }>;
  skills: string[];
  claims: Claim[];
};

type JobForGeneration = {
  originalDescription: string;
  company: { value: string | null };
  title: { value: string | null };
  requiredSkills: { value: string[] };
  preferredSkills: { value: string[] };
  selectionCriteria: { value: string[] };
};

type FitForGeneration = {
  strongMatches: string[];
  transferableStrengths: string[];
  recommendedPositioning: string;
};

export type GenerateApplicationContentInput = {
  profile: CandidateForGeneration;
  job: JobForGeneration;
  fit: FitForGeneration;
};

export type GeneratedApplicationContent = {
  content: GroundedApplicationContent;
  provider: "deterministic" | "openai";
  model: string;
};

function usableClaimIds(profile: CandidateForGeneration) {
  return new Set(
    profile.claims
      .filter((claim) => claim.status === "verified" || claim.status === "user-entered")
      .map((claim) => claim.id),
  );
}

function onlyUsable(ids: string[], usable: Set<string>, fallback: string[]) {
  const selected = ids.filter((id) => usable.has(id));
  return selected.length ? selected : fallback;
}

function formatPeriod(period: { start: string; end: string | null }) {
  return `${period.start} - ${period.end ?? "present"}`;
}

function jobTerms(job: JobForGeneration) {
  return `${job.title.value ?? ""} ${job.originalDescription}`.toLowerCase();
}

function rankedEvidence(profile: CandidateForGeneration, job: JobForGeneration) {
  const terms = jobTerms(job);
  const score = (text: string) => {
    const words = text.toLowerCase().split(/[^a-z0-9+#]+/).filter((word) => word.length >= 3);
    return words.reduce((sum, word) => sum + (terms.includes(word) ? 1 : 0), 0);
  };
  const projects = [...profile.projects].sort((left, right) =>
    score(`${right.name} ${right.type} ${right.technologies.join(" ")}`)
      - score(`${left.name} ${left.type} ${left.technologies.join(" ")}`),
  );
  const employment = [...profile.employment].sort((left, right) =>
    score(`${right.role} ${right.highlights.join(" ")}`)
      - score(`${left.role} ${left.highlights.join(" ")}`),
  );
  return { projects, employment };
}

function deterministicContent(
  input: GenerateApplicationContentInput,
): GroundedApplicationContent {
  const { profile, job, fit } = input;
  const usable = usableClaimIds(profile);
  const fallback = profile.claims
    .filter((claim) => usable.has(claim.id))
    .slice(0, 2)
    .map((claim) => claim.id);
  if (!fallback.length) {
    throw new HttpError(422, "The candidate profile has no confirmed evidence for document generation");
  }

  const { projects, employment } = rankedEvidence(profile, job);
  const project = projects[0];
  const role = employment[0];
  if (!project || !role) {
    throw new HttpError(422, "The candidate profile needs employment and project evidence");
  }
  const projectClaims = onlyUsable(project.claimIds, usable, fallback);
  const roleClaims = onlyUsable(role.claimIds, usable, fallback);
  const workRightsClaims = onlyUsable(profile.workRights.claimIds, usable, fallback);
  const company = job.company.value ?? "the employer";
  const title = job.title.value ?? "the advertised role";

  const requestedSkills = [
    ...job.requiredSkills.value,
    ...job.preferredSkills.value,
  ];
  const selectedSkills = profile.skills
    .filter((skill) => requestedSkills.some((item) =>
      item.toLowerCase().includes(skill.toLowerCase())
        || skill.toLowerCase().includes(item.toLowerCase()),
    ))
    .concat(profile.skills)
    .filter((skill, index, all) =>
      all.findIndex((item) => item.toLowerCase() === skill.toLowerCase()) === index,
    )
    .slice(0, 12);

  const skillClaim = profile.claims.find((claim) =>
    claim.category === "skill" && usable.has(claim.id),
  )?.id;
  const skillEvidence = skillClaim ? [skillClaim] : projectClaims;

  const sections: GroundedApplicationContent["sections"] = [
    {
      heading: "Relevant experience",
      title: role.role,
      subtitle: `${role.employer} | ${formatPeriod(role.period)}`,
      bullets: role.highlights.slice(0, 4).map((text) => ({
        text,
        evidenceClaimIds: roleClaims,
      })),
    },
    {
      heading: "Selected project",
      title: project.name,
      subtitle: project.organisation ?? project.type,
      bullets: project.highlights.slice(0, 4).map((text) => ({
        text,
        evidenceClaimIds: projectClaims,
      })),
    },
  ];

  const otherProject = projects[1];
  if (otherProject) {
    const evidence = onlyUsable(otherProject.claimIds, usable, fallback);
    sections.push({
      heading: "Additional project",
      title: otherProject.name,
      subtitle: otherProject.type,
      bullets: otherProject.highlights.slice(0, 3).map((text) => ({
        text,
        evidenceClaimIds: evidence,
      })),
    });
  }

  const education = profile.education.slice(0, 3).map((item) => ({
    degree: item.qualification,
    institution: item.institution,
    period: formatPeriod(item.period),
    evidenceClaimIds: onlyUsable(item.claimIds, usable, fallback),
  }));

  const summaryEvidence = [...new Set([...roleClaims, ...projectClaims])].slice(0, 8);
  const summary = [
    `Applied technology candidate with verified experience from ${role.employer} and delivery evidence from ${project.name}.`,
    fit.recommendedPositioning,
  ].join(" ");

  const primaryEducation = profile.education[0];
  const primaryEducationClaims = primaryEducation
    ? onlyUsable(primaryEducation.claimIds, usable, fallback)
    : fallback;
  const otherProjectClaims = otherProject
    ? onlyUsable(otherProject.claimIds, usable, fallback)
    : fallback;
  const coverLetterParagraphs = [
    {
      text: `${title} at ${company} aligns with my verified experience in applied technology, operational problem-solving and stakeholder collaboration. My strongest relevant evidence comes from ${project.name} and my work with ${role.employer}.`,
      evidenceClaimIds: summaryEvidence,
    },
    {
      text: `${role.highlights.slice(0, 4).join(". ")}. This experience developed practical judgement about translating requirements into work that people can use, communicating with different stakeholders and staying focused on operational priorities.`,
      evidenceClaimIds: roleClaims,
    },
    {
      text: `${project.highlights.slice(0, 4).join(". ")}. This project demonstrates a grounded approach to product delivery: understand a real problem, build across the required technical layers, test with users and improve the solution from practical feedback.`,
      evidenceClaimIds: projectClaims,
    },
    ...(otherProject ? [{
      text: `My additional project experience includes ${otherProject.name}, where my verified work covered ${otherProject.technologies.slice(0, 8).join(", ")}. ${otherProject.highlights.slice(0, 2).join(". ")}. Together with ${project.name}, this gives me practical evidence across software delivery, data and applied AI rather than a purely theoretical background.`,
      evidenceClaimIds: [...new Set([...otherProjectClaims, ...projectClaims])].slice(0, 8),
    }] : []),
    ...(primaryEducation ? [{
      text: `My ${primaryEducation.qualification} from ${primaryEducation.institution} complements that delivery experience. Relevant confirmed study includes ${primaryEducation.details.slice(0, 7).join(", ")}. I would position this foundation alongside the role-relevant skills selected from my verified profile: ${selectedSkills.slice(0, 10).join(", ")}.`,
      evidenceClaimIds: [...new Set([...primaryEducationClaims, ...skillEvidence])].slice(0, 8),
    }] : []),
    {
      text: `[USER INPUT REQUIRED: add one genuine, company-specific reason for wanting to join ${company}, based on information you have personally reviewed.]`,
      evidenceClaimIds: summaryEvidence,
    },
    {
      text: `I am based in ${profile.location.city}, ${profile.location.state}, and hold full Australian working rights under my current ${profile.workRights.visa}, subclass ${profile.workRights.visaSubclass}, subject to my current visa conditions. I would welcome a conversation about how my verified experience and project evidence could support the priorities of ${title}.`,
      evidenceClaimIds: workRightsClaims,
    },
  ];

  const selectionCriteria = job.selectionCriteria.value.map((criterion) => ({
    criterion,
    response: {
      text: `[USER INPUT REQUIRED] The available verified evidence includes ${project.name} and ${role.employer}; review the exact criterion and add a specific confirmed example before submission.`,
      evidenceClaimIds: summaryEvidence,
    },
    confidence: 0.45,
    factsNeedingConfirmation: ["A criterion-specific situation, action and result must be confirmed by the user."],
  }));

  return groundedApplicationContentSchema.parse({
    summary: { text: summary, evidenceClaimIds: summaryEvidence },
    skills: selectedSkills.map((name) => ({ name, evidenceClaimIds: skillEvidence })),
    sections,
    education,
    coverLetterParagraphs,
    selectionCriteria,
  });
}

function providerSelection() {
  const selected = process.env.JOB_AGENT_AI_PROVIDER?.trim().toLowerCase();
  if (selected && !["openai", "mock", "deterministic"].includes(selected)) {
    throw new HttpError(500, "JOB_AGENT_AI_PROVIDER is invalid");
  }
  if (selected === "mock" || selected === "deterministic") return "deterministic" as const;
  if (selected === "openai") return "openai" as const;
  return process.env.OPENAI_API_KEY ? "openai" as const : "deterministic" as const;
}

async function openAiContent(
  input: GenerateApplicationContentInput,
): Promise<GeneratedApplicationContent> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "AI_NOT_CONFIGURED");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
  const client = new OpenAI({ apiKey });
  const canonicalContent = deterministicContent(input);
  const allowedClaims = input.profile.claims.filter((claim) =>
    claim.status === "verified" || claim.status === "user-entered",
  );

  try {
    const response = await client.responses.parse({
      model,
      input: [
        {
          role: "system",
          content: [
            "Create an Australian-style, evidence-grounded application pack.",
            "Use only facts present in the candidate profile and only the supplied verified or user-entered claim IDs.",
            "Every generated statement must cite at least one supporting claim ID.",
            "Never invent employers, dates, qualifications, licences, citizenship, residency, clearance, metrics, revenue, savings, users, clients or contract values.",
            "Do not turn an inferred or missing fact into an affirmative claim.",
            "Keep the resume concise and the cover letter natural, specific and approximately 300-500 words.",
            "For selection criteria with insufficient evidence, write [USER INPUT REQUIRED] and identify the missing fact.",
            "The canonicalPack supplied by the user is the complete factual allowlist.",
            "Only select or reorder whole canonicalPack blocks. Copy every selected block verbatim; do not paraphrase or add text.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            candidate: input.profile,
            allowedClaims,
            job: input.job,
            fitAssessment: input.fit,
            canonicalPack: canonicalContent,
          }).slice(0, 100_000),
        },
      ],
      text: {
        format: zodTextFormat(groundedApplicationContentSchema, "grounded_application_pack"),
      },
    });

    if (!response.output_parsed) {
      throw new HttpError(502, "AI returned no validated application content");
    }
    const content = groundedApplicationContentSchema.parse(response.output_parsed);
    if (!isCanonicalApplicationContentSelection(content, canonicalContent)) {
      return {
        content: canonicalContent,
        provider: "deterministic",
        model: "job-agent-deterministic-v1-model-fallback",
      };
    }
    return {
      content,
      provider: "openai",
      model,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) throw new HttpError(503, "AI_NOT_CONFIGURED");
    if (status === 429) throw new HttpError(429, "AI rate limit reached; try again shortly");
    throw new HttpError(502, "AI generation is temporarily unavailable");
  }
}

export async function generateApplicationContent(
  input: GenerateApplicationContentInput,
): Promise<GeneratedApplicationContent> {
  if (providerSelection() === "openai") return openAiContent(input);
  return {
    content: deterministicContent(input),
    provider: "deterministic",
    model: "job-agent-deterministic-v1",
  };
}
