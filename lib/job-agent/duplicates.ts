import { z } from "zod";
import type { Application, StructuredJob } from "./schemas";

export const duplicateDetectionSchema = z.object({
  duplicate: z.boolean(),
  matchedApplicationId: z.string().min(1).nullable(),
  reason: z.enum([
    "same-application-url",
    "same-job-url",
    "same-company-and-role",
    "none",
  ]),
  fingerprint: z.string().min(1),
});

export type DuplicateDetection = z.infer<typeof duplicateDetectionSchema>;

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "source",
  "trackingid",
]);

export function canonicaliseJobUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function canonicaliseCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:pty\.?\s*ltd\.?|limited|inc\.?|llc|australia)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicaliseRole(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*(?:perth|sydney|melbourne|brisbane|remote|hybrid|wa|nsw|vic|qld)[^)]*\)/g, "")
    .replace(/\b(?:job|position|role)\b/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createJobFingerprint(company: string, role: string): string {
  return `${canonicaliseCompany(company)}::${canonicaliseRole(role)}`;
}

/**
 * Duplicate checks are deterministic and local. They intentionally do not use
 * fuzzy AI matching, which could silently hide a distinct role.
 */
export function detectDuplicateApplication(
  job: StructuredJob,
  existingApplications: Application[],
): DuplicateDetection {
  const company = job.company.value ?? "unknown-company";
  const role = job.title.value ?? "unknown-role";
  const fingerprint = createJobFingerprint(company, role);
  const applicationUrl = canonicaliseJobUrl(job.applicationUrl.value);
  const jobUrl = canonicaliseJobUrl(job.sourceUrl.value);

  for (const application of existingApplications) {
    if (application.status === "WITHDRAWN") continue;
    if (
      applicationUrl
      && application.applicationUrl
      && applicationUrl === canonicaliseJobUrl(application.applicationUrl)
    ) {
      return duplicateDetectionSchema.parse({
        duplicate: true,
        matchedApplicationId: application.id,
        reason: "same-application-url",
        fingerprint,
      });
    }
    if (jobUrl && application.jobUrl && jobUrl === canonicaliseJobUrl(application.jobUrl)) {
      return duplicateDetectionSchema.parse({
        duplicate: true,
        matchedApplicationId: application.id,
        reason: "same-job-url",
        fingerprint,
      });
    }
    if (createJobFingerprint(application.company, application.role) === fingerprint) {
      return duplicateDetectionSchema.parse({
        duplicate: true,
        matchedApplicationId: application.id,
        reason: "same-company-and-role",
        fingerprint,
      });
    }
  }

  return duplicateDetectionSchema.parse({
    duplicate: false,
    matchedApplicationId: null,
    reason: "none",
    fingerprint,
  });
}
