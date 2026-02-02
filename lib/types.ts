export type JobStatus = "applied" | "interview" | "rejected" | "ghosted" | "offer";

export type JobSource =
  | "LinkedIn"
  | "Indeed"
  | "SEEK"
  | "AngelList"
  | "Company site"
  | "Referral"
  | "Other";

export type JobApplication = {
  id: string;
  company: string;
  title: string;
  location?: string;
  source?: JobSource | string;
  status: JobStatus;
  jobDescription?: string;
  appliedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobDraft = Omit<JobApplication, "id" | "createdAt" | "updatedAt">;

export type ResumeRecord = {
  id: string;
  fileName: string;
  downloadUrl: string;
  status: "uploaded" | "processing" | "ready";
  uploadedAt: string;
  parsedText?: string;
};

export type ProfileSkills = {
  languages: string[];
  tools: string[];
  cloud: string[];
  databases: string[];
};

export type WorkExperience = {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
  tools?: string[];
};

export type Project = {
  title: string;
  stack: string[];
  impact?: string;
  bullets: string[];
};

export type Education = {
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
};

export type Certification = {
  name: string;
  issuer?: string;
  year?: string;
  url?: string;
};

export type Profile = {
  id?: string;
  fullName?: string;
  email?: string;
  visaStatus?: string;
  targetRoles: string[];
  preferredLocations: string[];
  yearsExperienceApprox?: number;
  skills: ProfileSkills;
  workExperience: WorkExperience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  hobbies?: string[];
  // Legacy/supporting fields
  preferredTitles?: string[];
  resumeText?: string;
  updatedAt?: string;
};

export type DocumentRecord = {
  id: string;
  fileName: string;
  downloadUrl: string;
  type: "transcript" | "degree" | "certification" | "other";
  uploadedAt: string;
};

export type AsyncState<T> = {
  data: T;
  loading: boolean;
  error?: string | null;
};
