import {
  fitAssessmentSchema,
  type ApplicationRecommendation,
  type CandidateProfile,
  type EligibilityAssessment,
  type FitAssessment,
  type JobRequirement,
  type StructuredJob,
} from "./schemas";

export type ScoreOptions = { assessedAt?: string };
type RoleFamily = "ai" | "data" | "software" | "solutions" | "general";

const SKILL_ALIASES: Record<string, string> = {
  "artificial intelligence": "ai",
  "applied ai": "ai",
  "generative ai": "ai",
  "machine learning": "machine learning",
  ml: "machine learning",
  "natural language processing": "nlp",
  nlp: "nlp",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  "node js": "nodejs",
  nodejs: "nodejs",
  reactjs: "react",
  "rest api": "rest api",
  "rest apis": "rest api",
  websocket: "websockets",
  websockets: "websockets",
  "power bi": "power bi",
  powerbi: "power bi",
  "data analysis": "data analysis",
  analytics: "data analysis",
};

function normalise(value: string): string {
  const basic = value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return SKILL_ALIASES[basic] ?? basic;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function candidateSkillSet(profile: CandidateProfile): Set<string> {
  const values = [
    ...profile.skills,
    ...profile.education.flatMap((education) => education.details),
    ...profile.projects.flatMap((project) => project.technologies),
  ];
  return new Set(values.map(normalise));
}

function skillMatches(candidateSkills: Set<string>, requiredSkill: string): boolean {
  const required = normalise(requiredSkill);
  if (candidateSkills.has(required)) return true;
  return [...candidateSkills].some((candidate) =>
    candidate.length >= 3
    && required.length >= 3
    && (candidate.includes(required) || required.includes(candidate)),
  );
}

function roleFamily(job: StructuredJob): RoleFamily {
  const text = `${job.title.value ?? ""} ${job.originalDescription}`.toLowerCase();
  if (/\b(?:ai|artificial intelligence|machine learning|ml engineer|nlp|generative)\b/.test(text)) return "ai";
  if (/\b(?:data scientist|data analyst|analytics|business intelligence|bi analyst)\b/.test(text)) return "data";
  if (/\b(?:software engineer|developer|full[- ]stack|backend|frontend)\b/.test(text)) return "software";
  if (/\b(?:solutions|implementation|technical business analyst|consultant)\b/.test(text)) return "solutions";
  return "general";
}

function requiredYears(job: StructuredJob): number | undefined {
  const matches = [...job.originalDescription.matchAll(/\b(\d+)\+?\s+years?\b/gi)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  return matches.length ? Math.max(...matches) : undefined;
}

function scoreTechnicalSkills(job: StructuredJob, profile: CandidateProfile) {
  const candidateSkills = candidateSkillSet(profile);
  const required = unique(job.requiredSkills.value);
  const preferred = unique(job.preferredSkills.value);
  const fallback = unique(job.technologyStack.value);

  const requiredMatches = required.filter((skill) => skillMatches(candidateSkills, skill));
  const preferredMatches = preferred.filter((skill) => skillMatches(candidateSkills, skill));
  const fallbackMatches = fallback.filter((skill) => skillMatches(candidateSkills, skill));

  let awarded: number;
  if (required.length > 0 || preferred.length > 0) {
    const requiredRatio = required.length ? requiredMatches.length / required.length : 1;
    const preferredRatio = preferred.length ? preferredMatches.length / preferred.length : 1;
    awarded = Math.round(25 * (requiredRatio * 0.8 + preferredRatio * 0.2));
  } else if (fallback.length > 0) {
    awarded = Math.round(25 * (fallbackMatches.length / fallback.length));
  } else {
    awarded = 17;
  }

  return {
    awarded,
    matches: unique([...requiredMatches, ...preferredMatches, ...fallbackMatches]),
    missingRequired: required.filter((skill) => !skillMatches(candidateSkills, skill)),
    missingPreferred: preferred.filter((skill) => !skillMatches(candidateSkills, skill)),
  };
}

function scoreExperience(job: StructuredJob, family: RoleFamily) {
  const years = requiredYears(job);
  if (years && years >= 7) {
    return { awarded: 4, concern: `The role asks for ${years}+ years of experience.` };
  }
  if (years && years >= 5) {
    return { awarded: 7, concern: `The role asks for ${years}+ years of experience.` };
  }
  if (/\b(?:principal|head|director)\b/i.test(job.title.value ?? "")) {
    return { awarded: 3, concern: "The role is a principal or head-level position." };
  }
  if (/\b(?:senior|lead)\b/i.test(job.title.value ?? "")) {
    return { awarded: 9, concern: "The role is senior to the candidate's verified directly relevant experience." };
  }
  const scores: Record<RoleFamily, number> = {
    ai: 18,
    data: 18,
    software: 14,
    solutions: 16,
    general: 12,
  };
  return { awarded: scores[family], concern: undefined };
}

function scoreProjects(family: RoleFamily) {
  const scores: Record<RoleFamily, { awarded: number; evidence: string[] }> = {
    ai: {
      awarded: 15,
      evidence: ["The Liquid Audit", "Speech-to-speech meeting agent", "FastHomeRepair"],
    },
    data: {
      awarded: 13,
      evidence: ["The Liquid Audit", "FastHomeRepair"],
    },
    software: {
      awarded: 13,
      evidence: ["The Liquid Audit", "FastHomeRepair", "Speech-to-speech meeting agent"],
    },
    solutions: {
      awarded: 15,
      evidence: ["The Liquid Audit", "Speech-to-speech meeting agent"],
    },
    general: { awarded: 8, evidence: ["The Liquid Audit"] },
  };
  return scores[family];
}

function scoreEducation(job: StructuredJob, profile: CandidateProfile) {
  const requirements = job.requirements.filter((item) => item.category === "education" && item.importance === "required");
  const candidateEducation = profile.education.map((item) => item.qualification).join(" ").toLowerCase();
  if (requirements.some((item) => /\b(?:phd|doctorate)\b/i.test(item.text)) && !/\b(?:phd|doctorate)\b/.test(candidateEducation)) {
    return 0;
  }
  if (requirements.some((item) => /\b(?:data|analytics|computer science|ai|machine learning|engineering|stem|related)\b/i.test(item.text))) {
    return 10;
  }
  return requirements.length ? 7 : 9;
}

function scoreSeniority(job: StructuredJob): number {
  const seniority = `${job.seniority.value ?? ""} ${job.title.value ?? ""}`;
  if (/\b(?:principal|head|director)\b/i.test(seniority)) return 0;
  if (/\b(?:senior|lead)\b/i.test(seniority)) return 2;
  if (/\b(?:graduate|junior|associate|intern)\b/i.test(seniority)) return 10;
  if (/\bmid(?:-level)?\b/i.test(seniority)) return 7;
  return 8;
}

function scoreIndustry(job: StructuredJob): number {
  const industry = job.industry.value?.toLowerCase() ?? "";
  if (/\b(?:technology|health|hospitality|software|saas|telecommunications)\b/.test(industry)) return 5;
  return industry ? 3 : 4;
}

function scoreLocation(job: StructuredJob): number {
  const value = `${job.location.value ?? ""} ${job.workArrangement.value}`.toLowerCase();
  if (/\bperth\b|western australia|\bwa\b/.test(value)) return 5;
  if (/remote/.test(value) && /australia|unknown/.test(`${value} ${job.originalDescription.toLowerCase()}`)) return 5;
  if (/australia/.test(`${value} ${job.originalDescription.toLowerCase()}`)) return 4;
  if (job.location.value === null) return 3;
  return 1;
}

function recommendationFor(score: number, eligibility: EligibilityAssessment["decision"]): ApplicationRecommendation {
  if (eligibility === "ineligible") return "DO_NOT_APPLY";
  if (eligibility === "needs_review") return "REVIEW_FIRST";
  if (score >= 80) return "APPLY_NOW";
  if (score >= 65) return "APPLY_WITH_TAILORING";
  if (score >= 50) return "REVIEW_FIRST";
  if (score >= 35) return "LOW_PRIORITY";
  return "DO_NOT_APPLY";
}

function requirementIsMet(
  requirement: JobRequirement,
  profile: CandidateProfile,
  candidateSkills: Set<string>,
): boolean {
  if (requirement.category === "skill") {
    return profile.skills.some((skill) =>
      requirement.text.toLowerCase().includes(skill.toLowerCase())
      && skillMatches(candidateSkills, skill),
    );
  }
  if (requirement.category === "education") {
    return /\b(?:data|analytics|computer science|ai|machine learning|engineering|stem|related)\b/i.test(requirement.text)
      && profile.education.some((item) => /\b(?:data science|engineering)\b/i.test(item.qualification));
  }
  if (requirement.category === "experience") {
    const years = requirement.text.match(/\b(\d+)\+?\s+years?\b/i)?.[1];
    return !years || Number(years) <= 2;
  }
  return true;
}

export function scoreJobFit(
  job: StructuredJob,
  profile: CandidateProfile,
  eligibility: EligibilityAssessment,
  options: ScoreOptions = {},
): FitAssessment {
  if (eligibility.jobId !== job.id || eligibility.candidateProfileId !== profile.id) {
    throw new Error("Eligibility assessment does not belong to this job and candidate.");
  }

  const family = roleFamily(job);
  const technical = scoreTechnicalSkills(job, profile);
  const experience = scoreExperience(job, family);
  const projects = scoreProjects(family);
  const education = scoreEducation(job, profile);
  const seniority = scoreSeniority(job);
  const industry = scoreIndustry(job);
  const location = scoreLocation(job);
  const workRights = eligibility.decision === "eligible" ? 10 : eligibility.decision === "needs_review" ? 5 : 0;

  const categories: FitAssessment["categories"] = [
    {
      category: "technicalSkills",
      awarded: technical.awarded,
      maximum: 25,
      rationale: "Deterministic overlap between explicit job technologies and verified candidate skills.",
      evidence: technical.matches,
    },
    {
      category: "relevantExperience",
      awarded: experience.awarded,
      maximum: 20,
      rationale: experience.concern ?? "Verified employment contains directly relevant junior-level experience.",
      evidence: family === "ai"
        ? ["Norwood Systems - Data Science / AI Capstone and Internship"]
        : family === "data"
          ? ["Kids Health / NursePrac - Data Analysis Intern"]
          : ["Cognizant - Programmer Analyst Trainee", "The Ritz-Carlton Perth"],
    },
    {
      category: "projectRelevance",
      awarded: projects.awarded,
      maximum: 15,
      rationale: "Verified projects are selected by role family; no inferred achievements are added.",
      evidence: projects.evidence,
    },
    {
      category: "education",
      awarded: education,
      maximum: 10,
      rationale: "The candidate has a Master of Data Science and an engineering bachelor's degree.",
      evidence: ["Master of Data Science - University of Western Australia"],
    },
    {
      category: "roleSeniority",
      awarded: seniority,
      maximum: 10,
      rationale: seniority <= 2
        ? "Senior, lead, principal and head-level roles are penalised against verified experience."
        : "The role's stated seniority is compatible with a graduate or junior candidate.",
      evidence: job.seniority.value ? [job.seniority.value] : [],
    },
    {
      category: "industryTransferability",
      awarded: industry,
      maximum: 5,
      rationale: "Transferability uses verified technology, healthcare and hospitality delivery evidence.",
      evidence: ["The Liquid Audit", "Kids Health / NursePrac", "Norwood Systems"],
    },
    {
      category: "locationAndWorkArrangement",
      awarded: location,
      maximum: 5,
      rationale: "Preference is Perth, Western Australia, hybrid Perth, or remote within Australia.",
      evidence: job.location.value ? [job.location.value] : [],
    },
    {
      category: "workRightEligibility",
      awarded: workRights,
      maximum: 10,
      rationale: `Deterministic eligibility gate returned ${eligibility.decision}.`,
      evidence: eligibility.reasons.map((item) => item.excerpt),
    },
  ];

  const score = Math.round(categories.reduce((sum, category) => sum + category.awarded, 0));
  const candidateSkills = candidateSkillSet(profile);
  const unmetRequirements = job.requirements.filter((requirement) =>
    !requirementIsMet(requirement, profile, candidateSkills),
  );
  const gateFailures = eligibility.reasons.filter((item) => item.blocking).map((item) => item.message);
  const missingMandatory = unique([
    ...technical.missingRequired,
    ...unmetRequirements.filter((item) => item.importance === "required").map((item) => item.text),
    ...gateFailures,
  ]);
  const missingPreferred = unique([
    ...technical.missingPreferred,
    ...unmetRequirements.filter((item) => item.importance === "preferred").map((item) => item.text),
  ]);
  const concerns = unique([
    ...(experience.concern ? [experience.concern] : []),
    ...eligibility.reasons.filter((item) => !item.blocking && eligibility.decision === "needs_review").map((item) => item.message),
    ...(technical.missingRequired.length ? [`Missing explicit technical requirements: ${technical.missingRequired.join(", ")}.`] : []),
  ]);
  const recommendation = missingMandatory.length > 0 && eligibility.decision === "eligible" && score >= 50
    ? "REVIEW_FIRST" as const
    : recommendationFor(score, eligibility.decision);

  const rolePositioning: Record<RoleFamily, string> = {
    ai: "Lead with the Norwood real-time speech AI work, then The Liquid Audit as evidence of end-to-end applied product delivery.",
    data: "Lead with the UWA data-science degree and Kids Health reporting automation, supported by The Liquid Audit's operational analytics context.",
    software: "Lead with full-stack Liquid Audit delivery, FastHomeRepair cloud technologies and Cognizant enterprise-development training.",
    solutions: "Lead with The Liquid Audit's real-user delivery and stakeholder work, supported by technical AI and analytics implementation experience.",
    general: "Position verified technical delivery alongside operational problem-solving and stakeholder communication.",
  };

  return fitAssessmentSchema.parse({
    jobId: job.id,
    candidateProfileId: profile.id,
    score,
    categories,
    strongMatches: unique([
      ...technical.matches.map((skill) => `Verified skill match: ${skill}`),
      ...(family === "ai" ? ["Norwood real-time speech AI experience", "Speech-to-speech meeting agent"] : []),
      ...(family === "data" ? ["Master of Data Science", "Kids Health reporting automation"] : []),
    ]),
    transferableStrengths: [
      "The Liquid Audit: end-to-end product delivery in a live operational environment",
      "Stakeholder communication across frontline staff and leadership",
      "Applied automation and technical documentation",
    ],
    missingMandatoryRequirements: missingMandatory,
    missingPreferredRequirements: missingPreferred,
    likelyInterviewConcerns: concerns,
    recommendedPositioning: rolePositioning[family],
    recommendation,
    assessedAt: options.assessedAt ?? "1970-01-01T00:00:00.000Z",
    deterministicEligibilityDecision: eligibility.decision,
  });
}
