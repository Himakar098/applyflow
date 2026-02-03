import type { Profile, ProfileSkills, WorkExperience, Project, Education, Certification } from "@/lib/types";

export const emptyProfile = (): Profile => ({
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  github: "",
  portfolio: "",
  visaStatus: "",
  targetRoles: [],
  preferredLocations: [],
  preferredWorkModes: [],
  preferredSeniority: [],
  yearsExperienceApprox: undefined,
  skills: { languages: [], tools: [], cloud: [], databases: [] },
  workExperience: [],
  projects: [],
  education: [],
  certifications: [],
  hobbies: [],
  preferredTitles: [],
});

const toArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v || "").trim()).filter(Boolean) : [];

const toString = (value: unknown): string => (value ? String(value) : "");

function normalizeSkills(skills: unknown): ProfileSkills {
  if (!skills || typeof skills !== "object") {
    return { languages: [], tools: [], cloud: [], databases: [] };
  }
  const s = skills as Record<string, unknown>;
  return {
    languages: toArray(s.languages),
    tools: toArray(s.tools ?? s.tooling ?? s.stack),
    cloud: toArray(s.cloud),
    databases: toArray(s.databases),
  };
}

function normalizeWorkExperience(input: unknown): WorkExperience[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const exp = item as Record<string, unknown>;
    return {
      company: toString(exp.company),
      role: toString(exp.role ?? exp.title),
      startDate: toString(exp.startDate),
      endDate: toString(exp.endDate),
      bullets: toArray(exp.bullets ?? exp.achievements),
      tools: toArray(exp.tools),
    };
  });
}

function normalizeProjects(input: unknown): Project[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const proj = item as Record<string, unknown>;
    return {
      title: toString(proj.title),
      stack: toArray(proj.stack),
      impact: toString(proj.impact),
      bullets: toArray(proj.bullets),
    };
  });
}

function normalizeEducation(input: unknown): Education[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const edu = item as Record<string, unknown>;
    return {
      institution: toString(edu.institution ?? edu.school),
      degree: toString(edu.degree),
      field: toString(edu.field ?? edu.major),
      startDate: toString(edu.startDate),
      endDate: toString(edu.endDate),
    };
  });
}

function normalizeCertifications(input: unknown): Certification[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    const cert = item as Record<string, unknown>;
    return {
      name: toString(cert.name),
      issuer: toString(cert.issuer),
      year: toString(cert.year),
      url: toString(cert.url),
    };
  });
}

export function normalizeProfile(input?: unknown): Profile {
  const base = emptyProfile();
  if (!input || typeof input !== "object") return base;

  const data = input as Record<string, unknown>;
  const contact = (data.contact as Record<string, unknown>) ?? {};
  const links = (data.links as Record<string, unknown>) ?? {};

  const workExperience =
    Array.isArray(data.workExperience)
      ? normalizeWorkExperience(data.workExperience)
      : Array.isArray(data.experience)
        ? normalizeWorkExperience(data.experience)
        : [];

  return {
    ...base,
    fullName: toString(data.fullName ?? contact.name ?? data.name),
    email: toString(data.email ?? contact.email),
    phone: toString(data.phone ?? contact.phone),
    location: toString(data.location ?? contact.location),
    linkedin: toString(data.linkedin ?? links.linkedin),
    github: toString(data.github ?? links.github),
    portfolio: toString(data.portfolio ?? links.portfolio),
    visaStatus: toString(data.visaStatus),
    targetRoles: toArray(data.targetRoles ?? data.preferredTitles ?? (data.headline ? [data.headline] : [])),
    preferredLocations: toArray(data.preferredLocations ?? (contact.location ? [contact.location] : [])),
    preferredWorkModes: toArray(data.preferredWorkModes),
    preferredSeniority: toArray(data.preferredSeniority),
    yearsExperienceApprox: Number.isFinite(Number(data.yearsExperienceApprox))
      ? Number(data.yearsExperienceApprox)
      : workExperience.length || undefined,
    skills: normalizeSkills(data.skills),
    workExperience,
    projects: normalizeProjects(data.projects),
    education: normalizeEducation(data.education),
    certifications: normalizeCertifications(data.certifications),
    hobbies: toArray(data.hobbies),
    preferredTitles: toArray(data.preferredTitles),
  };
}
