export type JobStatus = "saved" | "applied" | "interview" | "rejected" | "ghosted" | "offer";

export type JobSource =
  | "LinkedIn"
  | "Indeed"
  | "SEEK"
  | "AngelList"
  | "Company site"
  | "Referral"
  | "Other";

export type ApplicationOutcome = "applied" | "rejected" | "ghosted" | "interview" | "offer" | "negotiating" | "accepted" | "declined";

export type ApplicationFeedback = {
  outcome: ApplicationOutcome;
  recordedAt: string;
  userNotes?: string;
};

export type AutoApplyMetadata = {
  recommendationId: string;
  submittedAt: string;
  queueId: string;
  method: "auto_submit" | "auto_fill_manual_submit";
  filledForms?: string[];
  manualTasksPending?: string[]; // Task IDs
};

export type JobApplication = {
  id: string;
  company: string;
  title: string;
  location?: string;
  source?: JobSource | string;
  status: JobStatus;
  jobDescription?: string;
  jobUrl?: string;
  applicationUrl?: string;
  followUpDate?: string;
  appliedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  checklist?: Record<string, boolean>;
  // Auto-apply tracking
  autoApplied?: AutoApplyMetadata;
  // Application outcome feedback
  feedback?: ApplicationFeedback;
};

export type JobDraft = Omit<JobApplication, "id" | "createdAt" | "updatedAt">;

export type ResumeRecord = {
  id: string;
  fileName: string;
  downloadUrl: string;
  storagePath?: string;
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
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  visaStatus?: string;
  targetRoles: string[];
  preferredLocations: string[];
  preferredLocationScope?: "city" | "state" | "country" | "world";
  preferredLocationCountry?: string;
  preferredLocationState?: string;
  preferredLocationCity?: string;
  preferredWorkModes?: string[];
  preferredSeniority?: string[];
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
