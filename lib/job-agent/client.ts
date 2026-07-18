"use client";

import { getAuthHeader } from "@/lib/firebase/getIdToken";

export type JobAgentProfile = {
  id?: string;
  fullName?: string;
  location?: string;
  workRights?: {
    visaType?: string;
    visa?: string;
    visaSubclass?: string;
    fullAustralianWorkRights?: boolean;
    fullWorkingRights?: boolean;
    australianCitizen?: boolean;
    permanentResident?: boolean;
    australianPermanentResident?: boolean;
    requiresSponsorship?: boolean | null;
    securityClearance?: string;
    australianDriverLicence?: boolean;
  };
  availability?: string;
  salaryPreference?: { minimum?: number; maximum?: number; currency?: string };
  preferredRoles?: string[];
  preferredIndustries?: string[];
  excludedCompanies?: string[];
  excludedRequirements?: string[];
  completeness?: number;
  claims?: Array<{ key: string; value?: unknown; status: string }>;
  [key: string]: unknown;
};

export type JobAgentJob = {
  id: string;
  company: string | ExtractedText;
  title: string | ExtractedText;
  location?: string | ExtractedText;
  workArrangement?: string | ExtractedText;
  employmentType?: string | ExtractedText;
  salary?: string | ExtractedText;
  sourceUrl?: string;
  applicationUrl?: string;
  originalDescription?: string;
  responsibilities?: string[] | ExtractedList;
  requiredSkills?: string[] | ExtractedList;
  preferredSkills?: string[] | ExtractedList;
  visaRequirements?: string[] | ExtractedList;
  citizenshipRequirements?: string[] | ExtractedList;
  clearanceRequirements?: string[] | ExtractedList;
  securityClearanceRequirements?: string[] | ExtractedList;
  driverLicenceRequirements?: string[] | ExtractedList;
  inferredFields?: string[];
  eligibility?: string;
  fitScore?: number;
  closingDate?: string | null;
  createdAt?: string;
  assessment?: JobAssessment;
  [key: string]: unknown;
};

export type ExtractedText = {
  value?: string | null;
  source?: string;
  excerpts?: string[];
  confidence?: number;
};

export type ExtractedList = {
  value?: string[];
  source?: string;
  excerpts?: string[];
  confidence?: number;
};

export type JobAssessment = {
  eligibility?: {
    status?: string;
    decision?: string;
    reasons?: Array<{ reason?: string; message?: string; excerpt?: string; code?: string } | string>;
  };
  fit?: {
    score?: number;
    breakdown?: Record<string, number | { score?: number; weight?: number; reason?: string }>;
    categories?: Array<{
      category: string;
      awarded: number;
      maximum: number;
      rationale?: string;
      evidence?: string[];
    }>;
    strongMatches?: string[];
    transferableStrengths?: string[];
    missingMandatoryRequirements?: string[];
    missingPreferredRequirements?: string[];
    likelyInterviewConcerns?: string[];
    recommendedPositioning?: string[] | string;
    recommendation?: string;
  };
  [key: string]: unknown;
};

export type JobAgentApplication = {
  id: string;
  jobId?: string;
  company?: string;
  role?: string;
  title?: string;
  status: string;
  source?: string;
  jobUrl?: string;
  applicationUrl?: string;
  fitScore?: number;
  eligibility?: string;
  dateDiscovered?: string | null;
  dateApplied?: string | null;
  closingDate?: string | null;
  followUpDate?: string | null;
  contactPerson?: string | null;
  resumeUsed?: string;
  coverLetterUsed?: string;
  notes?: string;
  outcome?: string | null;
  interviewStages?: Array<{
    id: string;
    stage: string;
    status: "planned" | "scheduled" | "completed" | "cancelled";
    scheduledAt?: string | null;
    notes?: string | null;
  }>;
  documents?: Array<{ id?: string; type?: string; fileName?: string; path?: string; url?: string }>;
  answers?: Array<{
    id?: string;
    question: string;
    proposedAnswer?: string;
    proposedValue?: string;
    answer?: string;
    source?: string;
    requiresReview?: boolean;
    confirmed?: boolean;
    confidence?: number;
    risk?: string;
  }>;
  approvals?: Array<{ id?: string; type?: string; status?: string; createdAt?: string }>;
  browserSession?: Record<string, unknown>;
  autofillPlanHash?: string | null;
  [key: string]: unknown;
};

export type AuditEvent = {
  id: string;
  type?: string;
  action?: string;
  summary?: string;
  applicationId?: string;
  jobId?: string;
  createdAt?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

type ErrorPayload = { error?: string; message?: string; details?: unknown };

export async function jobAgentRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeader();
  if (!authHeaders) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authHeaders)) {
    headers.set(name, value);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok) {
    const detail =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : `Request failed with status ${response.status}`;
    throw new Error(detail.replaceAll("_", " "));
  }

  return payload;
}

export async function jobAgentDownload(
  path: string,
  fallbackFileName: string,
): Promise<{ blob: Blob; fileName: string }> {
  const authHeaders = await getAuthHeader();
  if (!authHeaders) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch(path, {
    headers: authHeaders,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ErrorPayload;
    const detail = typeof payload.error === "string"
      ? payload.error
      : typeof payload.message === "string"
        ? payload.message
        : `Download failed with status ${response.status}`;
    throw new Error(detail.replaceAll("_", " "));
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const dispositionName = /filename="([^"]+)"/i.exec(disposition)?.[1];
  const fileName = (dispositionName || fallbackFileName).replace(/[^A-Za-z0-9._-]/g, "_");
  return { blob: await response.blob(), fileName };
}

export function unwrapList<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

export function unwrapRecord<T>(payload: unknown, keys: string[]): T | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  }
  return payload as T;
}

export function humanize(value?: string | null) {
  if (!value) return "Not set";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function extractedText(value: string | ExtractedText | null | undefined, fallback = "Not set") {
  if (typeof value === "string") return value || fallback;
  return value?.value || fallback;
}

export function extractedList(value: string[] | ExtractedList | null | undefined) {
  return Array.isArray(value) ? value : value?.value ?? [];
}
