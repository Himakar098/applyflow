import { z } from "zod";

import {
  applicationStateSchema,
  autofillPlanSchema,
  candidateProfileSchema,
} from "@/lib/job-agent/schemas";
import { bridgeAutofillPlanSchema } from "@/lib/job-agent/server/bridge-plan";
import { applicationExportKinds } from "@/lib/job-agent/server/generated-file-download";
import { groundedApplicationContentSchema } from "@/lib/job-agent/server/generated-documents";
import { isCredentialFreeHttpUrl } from "@/lib/security/url-policy";
export {
  manualSubmissionConfirmationSchema,
  manualSubmissionResolutionSchema,
  submissionResultInputSchema,
} from "@/lib/job-agent/server/submission-receipts";

const acceptedAutofillPlanSchema = z.union([autofillPlanSchema, bridgeAutofillPlanSchema]);

const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

const httpUrl = z.string().trim().url().max(2_000).refine(
  isCredentialFreeHttpUrl,
  "Only credential-free HTTP and HTTPS URLs are supported",
);

export const privateContactSchema = z.object({
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().min(5).max(40).nullable().optional(),
  address: z.string().trim().min(5).max(500).nullable().optional(),
}).strict();

export const profileUpdateSchema = z.object({
  profile: candidateProfileSchema,
  privateContact: privateContactSchema.optional(),
  confirmedClaimIds: z.array(z.string().min(1).max(200)).max(200).optional(),
}).strict();

export const pastedJobSchema = z.object({
  description: z.string().trim().min(80).max(120_000),
  title: optionalText(200),
  company: optionalText(200),
  location: optionalText(300),
  sourceUrl: httpUrl.optional(),
  applicationUrl: httpUrl.optional(),
}).strict();

export const jobImportSchema = z.discriminatedUnion("type", [
  pastedJobSchema.extend({ type: z.literal("paste") }),
  z.object({
    type: z.literal("url"),
    url: httpUrl,
  }).strict(),
  z.object({
    type: z.literal("csv"),
    csv: z.string().min(1).max(1_000_000),
  }).strict(),
]);

export const createApplicationSchema = z.object({
  jobId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
}).strict();

export const applicationStatusUpdateSchema = z.object({
  status: applicationStateSchema.refine(
    (status) => status !== "SUBMISSION_APPROVED" && status !== "SUBMITTED",
    "Submission approval and results must use their dedicated endpoints",
  ),
  plan: acceptedAutofillPlanSchema.optional(),
  planHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  explicitUserApproval: z.boolean().optional(),
  userInitiated: z.boolean().optional(),
}).strict();

export const generateAnswersSchema = z.object({
  questions: z.array(z.string().trim().min(1).max(1_000)).min(1).max(50),
}).strict();

export const updateAnswersSchema = z.object({
  answers: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    proposedValue: z.string().trim().max(5_000).nullable(),
    confirmed: z.boolean(),
  }).strict()).min(1).max(100),
}).strict();

export const generateDocumentsSchema = z.object({
  regenerate: z.boolean().optional(),
}).strict();

export const exportDocumentsSchema = z.object({
  documentId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
}).strict();

export const editApplicationDocumentSchema = z.object({
  documentId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  content: groundedApplicationContentSchema,
}).strict();

export const downloadApplicationDocumentSchema = z.object({
  documentId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  kind: z.enum(applicationExportKinds),
}).strict();

export const submissionApprovalSchema = z.object({
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const nullableDateText = z.string().trim().min(1).max(100).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Date must be an ISO-compatible value",
).nullable();

export const applicationTrackingUpdateSchema = z.object({
  contactPerson: z.string().trim().max(300).nullable().optional(),
  followUpDate: nullableDateText.optional(),
  notes: z.string().trim().max(20_000).nullable().optional(),
  outcome: z.string().trim().max(2_000).nullable().optional(),
  resumeUsed: z.string().trim().max(500).nullable().optional(),
  coverLetterUsed: z.string().trim().max(500).nullable().optional(),
  interviewStages: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    stage: z.string().trim().min(1).max(200),
    status: z.enum(["planned", "scheduled", "completed", "cancelled"]),
    scheduledAt: nullableDateText.optional(),
    notes: z.string().trim().max(5_000).nullable().optional(),
  }).strict()).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one tracking field is required");

export const autofillActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("inspect") }).strict(),
  z.object({ action: z.literal("save_plan"), plan: acceptedAutofillPlanSchema }).strict(),
  z.object({
    action: z.literal("approve_autofill"),
    expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    approvedFieldIds: z.array(z.string().min(1).max(300)).min(1).max(500),
    reviewedFieldIds: z.array(z.string().min(1).max(300)).max(500).optional(),
    explicitUserApproval: z.literal(true),
  }).strict(),
  z.object({ action: z.literal("start"), userInitiated: z.literal(true) }).strict(),
  z.object({ action: z.literal("pause"), reason: z.string().trim().min(1).max(500).optional() }).strict(),
  z.object({ action: z.literal("resume"), userInitiated: z.literal(true) }).strict(),
  z.object({
    action: z.literal("ready_to_submit"),
    plan: bridgeAutofillPlanSchema,
    approvedFieldIds: z.array(z.string().min(1).max(300)).min(1).max(500),
    reviewedFieldIds: z.array(z.string().min(1).max(300)).max(500).optional(),
  }).strict(),
]);

export type PrivateContact = z.infer<typeof privateContactSchema>;
export type PastedJobInput = z.infer<typeof pastedJobSchema>;
