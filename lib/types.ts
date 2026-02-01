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

export type Profile = {
  id: string;
  fullName: string;
  email?: string;
  preferredTitles: string[];
  preferredLocations: string[];
  visaStatus: string;
  updatedAt: string;
};

export type AsyncState<T> = {
  data: T;
  loading: boolean;
  error?: string | null;
};
