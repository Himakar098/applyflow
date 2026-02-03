import type { Profile } from "@/lib/types";
import type { ExternalJob, MatchBreakdown, RecommendedJob } from "@/lib/recommendations/types";

const ROLE_WEIGHT = 30;
const SKILLS_WEIGHT = 30;
const TECH_WEIGHT = 20;
const SENIORITY_WEIGHT = 10;
const LOCATION_WEIGHT = 10;

const seniorityKeywords: Record<string, string[]> = {
  entry: ["intern", "junior", "entry", "associate", "graduate"],
  mid: ["mid", "intermediate"],
  senior: ["senior", "sr", "lead", "principal", "staff"],
  manager: ["manager", "head", "director", "vp"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+.#-]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function uniqueTokens(values: string[]): string[] {
  const set = new Set(values.map((v) => v.toLowerCase()));
  return Array.from(set);
}

function inferSeniority(title: string) {
  const lower = title.toLowerCase();
  for (const [level, keys] of Object.entries(seniorityKeywords)) {
    if (keys.some((k) => lower.includes(k))) return level;
  }
  return "unspecified";
}

function computeRoleAlignment(rolePrefs: string[], title: string) {
  if (!rolePrefs.length) return { score: 0, reason: "" };
  const titleTokens = new Set(tokenize(title));
  let best = 0;
  let matchedRole = "";
  rolePrefs.forEach((role) => {
    const roleTokens = tokenize(role);
    const overlap = roleTokens.filter((t) => titleTokens.has(t)).length;
    const ratio = roleTokens.length ? overlap / roleTokens.length : 0;
    if (ratio > best) {
      best = ratio;
      matchedRole = role;
    }
  });
  const score = Math.min(1, best);
  const reason = matchedRole ? `Role aligns with "${matchedRole}".` : "";
  return { score, reason };
}

function computeSkillOverlap(profileSkills: string[], jobText: string) {
  if (!profileSkills.length) return { score: 0, reason: "", matches: [] as string[] };
  const jobTokens = new Set(tokenize(jobText));
  const matches = uniqueTokens(profileSkills).filter((s) => jobTokens.has(s.toLowerCase()));
  const ratio = matches.length / Math.max(5, profileSkills.length);
  const score = Math.min(1, ratio);
  const reason = matches.length
    ? `Matches ${matches.length} skills from your profile (${matches.slice(0, 5).join(", ")}).`
    : "";
  return { score, reason, matches };
}

function computeTechMatch(profileTech: string[], jobText: string) {
  if (!profileTech.length) return { score: 0, reason: "" };
  const jobTokens = new Set(tokenize(jobText));
  const matches = uniqueTokens(profileTech).filter((s) => jobTokens.has(s.toLowerCase()));
  const ratio = matches.length / Math.max(4, profileTech.length);
  const score = Math.min(1, ratio);
  const reason = matches.length ? `Tech overlap: ${matches.slice(0, 4).join(", ")}.` : "";
  return { score, reason };
}

function computeLocationMatch(locations: string[], jobLocation?: string) {
  if (!locations.length) return { score: 0, reason: "" };
  const loc = (jobLocation ?? "").toLowerCase();
  const matches = locations.filter((l) => loc.includes(l.toLowerCase()));
  const remoteMatch = locations.some((l) => l.toLowerCase().includes("remote")) && loc.includes("remote");
  const score = matches.length || remoteMatch ? 1 : 0;
  const reason = score ? `Location preference matched: ${matches[0] ?? "Remote"}.` : "";
  return { score, reason };
}

function computeSeniorityMatch(preferred: string[], title: string) {
  if (!preferred.length) return { score: 0, reason: "" };
  const inferred = inferSeniority(title);
  const normalizedPrefs = preferred.map((p) => p.toLowerCase());
  const score = normalizedPrefs.includes(inferred) ? 1 : 0;
  const reason = score ? `Seniority aligned with "${inferred}".` : "";
  return { score, reason };
}

function profileSkillList(profile: Profile) {
  const skills = [
    ...profile.skills.languages,
    ...profile.skills.tools,
    ...profile.skills.cloud,
    ...profile.skills.databases,
  ];
  const fromProjects = profile.projects.flatMap((p) => p.stack ?? []);
  const fromWork = profile.workExperience.flatMap((w) => w.tools ?? []);
  return uniqueTokens([...skills, ...fromProjects, ...fromWork]);
}

export function scoreJobs(profile: Profile, jobs: ExternalJob[]): RecommendedJob[] {
  const rolePrefs = profile.targetRoles ?? profile.preferredTitles ?? [];
  const locationPrefs = profile.preferredLocations ?? [];
  const workModes = profile.preferredWorkModes ?? [];
  const seniorityPrefs = profile.preferredSeniority ?? [];

  const allSkills = profileSkillList(profile);
  const techSkills = uniqueTokens([
    ...profile.skills.languages,
    ...profile.skills.tools,
    ...profile.skills.cloud,
    ...profile.skills.databases,
  ]);

  return jobs.map((job) => {
    const text = `${job.title} ${job.description ?? ""} ${job.location ?? ""}`;
    const role = computeRoleAlignment(rolePrefs, job.title);
    const skills = computeSkillOverlap(allSkills, text);
    const tech = computeTechMatch(techSkills, text);
    const location = computeLocationMatch([...locationPrefs, ...workModes], job.location);
    const seniority = computeSeniorityMatch(seniorityPrefs, job.title);

    const breakdown: MatchBreakdown = {
      role: Math.round(role.score * ROLE_WEIGHT),
      skills: Math.round(skills.score * SKILLS_WEIGHT),
      tech: Math.round(tech.score * TECH_WEIGHT),
      seniority: Math.round(seniority.score * SENIORITY_WEIGHT),
      location: Math.round(location.score * LOCATION_WEIGHT),
    };

    const matchScore = Math.min(
      100,
      breakdown.role + breakdown.skills + breakdown.tech + breakdown.seniority + breakdown.location,
    );

    const reasons = [role.reason, skills.reason, tech.reason, seniority.reason, location.reason].filter(Boolean);
    if (!reasons.length) {
      reasons.push("Profile has some overlap with this role.");
    }

    return {
      ...job,
      matchScore,
      matchReasons: reasons,
      matchBreakdown: breakdown,
    };
  });
}
