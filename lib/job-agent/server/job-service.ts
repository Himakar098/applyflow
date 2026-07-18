import "server-only";

import { HttpError } from "@/lib/auth/verify-id-token";
import {
  assessJobEligibility,
  eligibilityAssessmentSchema,
  extractJobDescription,
  fitAssessmentSchema,
  scoreJobFit,
  structuredJobSchema,
  type EligibilityAssessment,
  type FitAssessment,
  type StructuredJob,
} from "@/lib/job-agent";
import { importPublicJobUrl } from "@/lib/job-import/adapters";
import { parseJobCsv } from "@/lib/job-import/csv";
import { recordAuditEvent } from "@/lib/job-agent/server/audit-service";
import { getCandidateProfile } from "@/lib/job-agent/server/profile-service";
import type { PastedJobInput } from "@/lib/job-agent/server/request-schemas";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  listRecords,
  userCollection,
  userDocument,
} from "@/lib/job-agent/server/store";

type StoredJob = StructuredJob & {
  createdAt: string;
  updatedAt: string;
  eligibility: EligibilityAssessment["decision"];
  fitScore: number;
};

type StoredAssessment = {
  id: string;
  jobId: string;
  eligibility: EligibilityAssessment;
  fit: FitAssessment;
  createdAt: string;
  updatedAt: string;
};

function explicitText(value: string) {
  return {
    value,
    source: "explicit" as const,
    excerpts: [value],
    confidence: 1,
  };
}

function extractWithOverrides(id: string, input: PastedJobInput, now: string) {
  const extracted = extractJobDescription({
    id,
    description: input.description,
    sourceUrl: input.sourceUrl,
    applicationUrl: input.applicationUrl,
    extractedAt: now,
  });
  return structuredJobSchema.parse({
    ...extracted,
    company: input.company ? explicitText(input.company) : extracted.company,
    title: input.title ? explicitText(input.title) : extracted.title,
    location: input.location ? explicitText(input.location) : extracted.location,
  });
}

function parseStoredJob(input: StoredJob): StructuredJob {
  return structuredJobSchema.parse(input);
}

export function assessmentView(record: StoredAssessment) {
  const eligibility = eligibilityAssessmentSchema.parse(record.eligibility);
  const fit = fitAssessmentSchema.parse(record.fit);
  return {
    eligibility: {
      ...eligibility,
      status: eligibility.decision,
      reasons: eligibility.reasons.map((reason) => ({
        ...reason,
        reason: reason.message,
      })),
    },
    fit: {
      ...fit,
      breakdown: Object.fromEntries(
        fit.categories.map((category) => [
          category.category,
          {
            score: category.awarded,
            weight: category.maximum,
            reason: category.rationale,
          },
        ]),
      ),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function inferredFields(job: StructuredJob) {
  const fields: Array<[string, { source: string }]> = [
    ["company", job.company],
    ["title", job.title],
    ["location", job.location],
    ["workArrangement", job.workArrangement],
    ["employmentType", job.employmentType],
    ["salary", job.salary],
    ["datePosted", job.datePosted],
    ["closingDate", job.closingDate],
    ["industry", job.industry],
    ["seniority", job.seniority],
  ];
  return fields.filter(([, value]) => value.source === "inferred").map(([field]) => field);
}

export function jobView(jobRecord: StoredJob, assessment?: StoredAssessment | null) {
  const job = parseStoredJob(jobRecord);
  const viewAssessment = assessment ? assessmentView(assessment) : undefined;
  return {
    id: job.id,
    company: job.company.value ?? "Unknown company",
    title: job.title.value ?? "Untitled role",
    location: job.location.value ?? undefined,
    workArrangement: job.workArrangement.value,
    employmentType: job.employmentType.value ?? undefined,
    salary: job.salary.value ?? undefined,
    datePosted: job.datePosted.value ?? undefined,
    closingDate: job.closingDate.value ?? undefined,
    sourceUrl: job.sourceUrl.value ?? undefined,
    applicationUrl: job.applicationUrl.value ?? undefined,
    originalDescription: job.originalDescription,
    responsibilities: job.responsibilities.value,
    requiredSkills: job.requiredSkills.value,
    preferredSkills: job.preferredSkills.value,
    requiredExperience: job.requiredExperience.value,
    educationRequirements: job.educationRequirements.value,
    visaRequirements: job.visaRequirements.value,
    citizenshipRequirements: job.citizenshipRequirements.value,
    clearanceRequirements: job.securityClearanceRequirements.value,
    driverLicenceRequirements: job.driverLicenceRequirements.value,
    selectionCriteria: job.selectionCriteria.value,
    applicationQuestions: job.applicationQuestions.value,
    inferredFields: inferredFields(job),
    eligibility: viewAssessment?.eligibility.status ?? jobRecord.eligibility,
    fitScore: viewAssessment?.fit.score ?? jobRecord.fitScore,
    createdAt: jobRecord.createdAt,
    updatedAt: jobRecord.updatedAt,
    structured: job,
    assessment: viewAssessment,
  };
}

export async function getStoredJob(uid: string, jobId: string) {
  const record = await getRecord<StoredJob>(uid, JOB_AGENT_COLLECTIONS.jobs, jobId);
  if (!record) throw new HttpError(404, "Job not found");
  return record;
}

export async function getStoredAssessment(uid: string, jobId: string) {
  return getRecord<StoredAssessment>(uid, JOB_AGENT_COLLECTIONS.assessments, jobId);
}

export async function assessStoredJob(uid: string, jobRecord: StoredJob) {
  const now = new Date().toISOString();
  const job = parseStoredJob(jobRecord);
  const profile = await getCandidateProfile(uid);
  const eligibility = assessJobEligibility(job, profile, { assessedAt: now });
  const fit = scoreJobFit(job, profile, eligibility, { assessedAt: now });
  const existing = await getStoredAssessment(uid, job.id);
  const record: StoredAssessment = {
    id: job.id,
    jobId: job.id,
    eligibility,
    fit,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await Promise.all([
    userDocument(uid, JOB_AGENT_COLLECTIONS.assessments, job.id).set(record),
    userDocument(uid, JOB_AGENT_COLLECTIONS.jobs, job.id).update({
      eligibility: eligibility.decision,
      fitScore: fit.score,
      updatedAt: now,
    }),
  ]);
  return record;
}

export async function createAndAssessJob(uid: string, input: PastedJobInput) {
  const now = new Date().toISOString();
  const id = `job-${crypto.randomUUID()}`;
  const profile = await getCandidateProfile(uid);
  const job = extractWithOverrides(id, input, now);
  const eligibility = assessJobEligibility(job, profile, { assessedAt: now });
  const fit = scoreJobFit(job, profile, eligibility, { assessedAt: now });
  const jobRecord: StoredJob = {
    ...job,
    createdAt: now,
    updatedAt: now,
    eligibility: eligibility.decision,
    fitScore: fit.score,
  };
  const assessment: StoredAssessment = {
    id,
    jobId: id,
    eligibility,
    fit,
    createdAt: now,
    updatedAt: now,
  };
  await Promise.all([
    userDocument(uid, JOB_AGENT_COLLECTIONS.jobs, id).set(jobRecord),
    userDocument(uid, JOB_AGENT_COLLECTIONS.assessments, id).set(assessment),
  ]);
  await Promise.all([
    recordAuditEvent(uid, {
      type: "job_captured",
      occurredAt: now,
      metadata: { jobId: id, sourceUrl: input.sourceUrl ?? null, summary: "Job captured" },
    }),
    recordAuditEvent(uid, {
      type: "job_parsed",
      occurredAt: now,
      metadata: { jobId: id, inferredFields: inferredFields(job), summary: "Job parsed" },
    }),
    recordAuditEvent(uid, {
      type: "eligibility_decided",
      occurredAt: now,
      metadata: { jobId: id, decision: eligibility.decision, reasonCodes: eligibility.reasons.map((reason) => reason.code), summary: "Eligibility decided" },
    }),
    recordAuditEvent(uid, {
      type: "fit_scored",
      occurredAt: now,
      metadata: { jobId: id, score: fit.score, recommendation: fit.recommendation, summary: "Fit scored" },
    }),
  ]);
  return jobView(jobRecord, assessment);
}

export async function importJobs(
  uid: string,
  input:
    | ({ type: "paste" } & PastedJobInput)
    | { type: "url"; url: string }
    | { type: "csv"; csv: string },
) {
  if (input.type === "paste") {
    const { type: _type, ...job } = input;
    void _type;
    return [await createAndAssessJob(uid, job)];
  }
  if (input.type === "url") {
    const imported = await importPublicJobUrl(input.url);
    return [await createAndAssessJob(uid, {
      description: imported.description,
      title: imported.title,
      company: imported.company,
      location: imported.location,
      sourceUrl: imported.sourceUrl,
      applicationUrl: imported.applicationUrl,
    })];
  }

  const rows = parseJobCsv(input.csv);
  const jobs = [];
  for (const row of rows) {
    jobs.push(await createAndAssessJob(uid, row));
  }
  return jobs;
}

export async function listJobs(
  uid: string,
  options: { eligibility?: string; limit?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  let query = userCollection(uid, JOB_AGENT_COLLECTIONS.jobs)
    .orderBy("createdAt", "desc")
    .limit(limit);
  if (options.eligibility) {
    query = userCollection(uid, JOB_AGENT_COLLECTIONS.jobs)
      .where("eligibility", "==", options.eligibility)
      .orderBy("createdAt", "desc")
      .limit(limit);
  }
  const jobs = await listRecords<StoredJob>(query);
  const assessments = await Promise.all(jobs.map((job) => getStoredAssessment(uid, job.id)));
  return jobs.map((job, index) => jobView(job, assessments[index]));
}

export async function readJob(uid: string, jobId: string) {
  const job = await getStoredJob(uid, jobId);
  const assessment = await getStoredAssessment(uid, jobId);
  return {
    job: jobView(job, assessment),
    assessment: assessment ? assessmentView(assessment) : null,
  };
}

export async function recomputeAssessment(uid: string, jobId: string) {
  const job = await getStoredJob(uid, jobId);
  const assessment = await assessStoredJob(uid, job);
  await Promise.all([
    recordAuditEvent(uid, {
      type: "eligibility_decided",
      metadata: { jobId, decision: assessment.eligibility.decision, summary: "Eligibility recomputed" },
    }),
    recordAuditEvent(uid, {
      type: "fit_scored",
      metadata: { jobId, score: assessment.fit.score, summary: "Fit recomputed" },
    }),
  ]);
  return assessmentView(assessment);
}

