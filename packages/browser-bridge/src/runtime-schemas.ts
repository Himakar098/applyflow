import { z } from "zod";

import {
  applicationSchema,
  approvalSchema,
  autofillPlanSchema,
  candidateProfileSchema,
} from "../../../lib/job-agent/schemas";

const safeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const portalKindSchema = z.enum([
  "generic",
  "greenhouse",
  "lever",
  "workday",
  "smartrecruiters",
  "successfactors",
  "pageup",
  "ashby",
]);

const credentialFreeHttpUrlSchema = z
  .string()
  .url()
  .max(2_000)
  .refine((value) => {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    );
  }, "URL must use credential-free HTTP or HTTPS");

const inspectedFieldSchema = z.object({
  id: z.string().min(1).max(300),
  selector: z.string().min(1).max(2_000),
  label: z.string().min(1).max(500),
  name: z.string().max(500),
  kind: z.enum([
    "text",
    "email",
    "tel",
    "url",
    "number",
    "date",
    "textarea",
    "select",
    "checkbox",
    "radio",
    "file",
    "password",
    "unknown",
  ]),
  required: z.boolean(),
  disabled: z.boolean(),
  visible: z.boolean(),
  hasValue: z.boolean(),
  placeholder: z.string().max(500).optional(),
  ariaLabel: z.string().max(500).optional(),
  autocomplete: z.string().max(200).optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .max(500)
    .optional(),
  sensitiveCategory: z.enum([
    "none",
    "captcha",
    "work_rights",
    "immigration",
    "citizenship",
    "security_clearance",
    "driver_licence",
    "salary",
    "availability",
    "identity",
    "demographic",
    "diversity",
    "legal_attestation",
    "unknown_question",
  ]),
  reviewRequired: z.boolean(),
});

const pauseSchema = z.object({
  code: z.enum([
    "CAPTCHA_DETECTED",
    "LEGAL_ATTESTATION",
    "SENSITIVE_DEMOGRAPHIC_FIELD",
    "IDENTITY_DECLARATION",
    "UNKNOWN_REQUIRED_QUESTION",
    "UNSUPPORTED_PORTAL",
    "USER_REVIEW_REQUIRED",
  ]),
  message: z.string().min(1).max(2_000),
  fieldId: z.string().max(300).optional(),
  severity: z.enum(["pause", "review"]),
});

/**
 * This mirrors the server bridge-plan trust boundary without importing a
 * `server-only` module into the local worker process.
 */
export const bridgeAutofillPlanSchema = z
  .object({
    id: z.string().min(1).max(300),
    applicationId: safeIdSchema,
    url: credentialFreeHttpUrlSchema,
    portal: portalKindSchema,
    createdAt: z.string().datetime({ offset: true }),
    state: z.literal("READY_FOR_REVIEW"),
    mappings: z
      .array(
        z.object({
          field: inspectedFieldSchema,
          profileKey: z.string().max(300).optional(),
          proposedValue: z
            .union([z.string(), z.number(), z.boolean()])
            .optional(),
          sourceLabel: z.string().max(500).optional(),
          provenance: z
            .enum([
              "verified",
              "user-entered",
              "needs-confirmation",
              "prohibited-from-inference",
            ])
            .optional(),
          confidence: z.number().min(0).max(1),
          reviewRequired: z.boolean(),
          status: z.enum(["ready", "needs_review", "blocked", "no_match"]),
          reason: z.string().max(2_000).optional(),
        }),
      )
      .max(500),
    pauses: z.array(pauseSchema).max(500),
    submitControls: z
      .array(
        z.object({
          id: z.string().min(1).max(300),
          selector: z.string().min(1).max(2_000),
          label: z.string().min(1).max(500),
          visible: z.boolean(),
          disabled: z.boolean(),
        }),
      )
      .max(20),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const fieldIds = new Set<string>();
    const fieldSelectors = new Set<string>();
    for (const [index, mapping] of plan.mappings.entries()) {
      if (fieldIds.has(mapping.field.id) || fieldSelectors.has(mapping.field.selector)) {
        ctx.addIssue({
          code: "custom",
          path: ["mappings", index, "field", "id"],
          message: "Autofill field ids and selectors must be unique",
        });
      }
      fieldIds.add(mapping.field.id);
      fieldSelectors.add(mapping.field.selector);
    }
    const submitIds = new Set<string>();
    const submitSelectors = new Set<string>();
    for (const [index, control] of plan.submitControls.entries()) {
      if (submitIds.has(control.id) || submitSelectors.has(control.selector)) {
        ctx.addIssue({
          code: "custom",
          path: ["submitControls", index, "id"],
          message: "Submit-control ids and selectors must be unique",
        });
      }
      submitIds.add(control.id);
      submitSelectors.add(control.selector);
    }
  });

export const autofillStateResponseSchema = z
  .object({
    ok: z.literal(true),
    application: applicationSchema,
    plan: autofillPlanSchema.nullable(),
    workerPlan: bridgeAutofillPlanSchema.nullable(),
    planHash: sha256Schema.nullable(),
    session: z.unknown().nullable().optional(),
  })
  .passthrough();

export const profileResponseSchema = z
  .object({
    ok: z.literal(true),
    profile: candidateProfileSchema,
    privateContact: z
      .object({
        email: z.string().email().max(320).nullable().optional(),
        phone: z.string().min(5).max(40).nullable().optional(),
        address: z.string().min(5).max(500).nullable().optional(),
      })
      .strict()
      .nullable(),
  })
  .passthrough();

export const approvalResponseSchema = z
  .object({
    ok: z.literal(true),
    approval: approvalSchema.nullable(),
  })
  .passthrough();

export const autofillMutationResponseSchema = z
  .object({
    ok: z.literal(true),
    application: applicationSchema,
    plan: autofillPlanSchema.nullable().optional(),
    workerPlan: bridgeAutofillPlanSchema.nullable().optional(),
    planHash: sha256Schema.nullable().optional(),
    session: z.unknown().nullable().optional(),
  })
  .passthrough();

export const consumedApprovalResponseSchema = z
  .object({
    ok: z.literal(true),
    application: applicationSchema,
    approval: approvalSchema,
    attempt: z
      .object({
        id: safeIdSchema,
        applicationId: safeIdSchema,
        approvalId: safeIdSchema,
        planHash: sha256Schema,
        status: z.literal("pending"),
        issuedAt: z.string().datetime({ offset: true }),
        expiresAt: z.string().datetime({ offset: true }),
        completedAt: z.null(),
        result: z.null(),
        completionToken: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
      })
      .passthrough(),
  })
  .passthrough();

export const submissionResultResponseSchema = z
  .object({
    ok: z.literal(true),
    application: applicationSchema,
    attempt: z.object({
      id: safeIdSchema,
      applicationId: safeIdSchema,
      planHash: sha256Schema,
      status: z.enum(["confirmed", "unknown", "failed", "manually_confirmed"]),
    }).passthrough(),
  })
  .passthrough();

export const applicationDetailResponseSchema = z
  .object({
    ok: z.literal(true),
    application: applicationSchema,
    documents: z.array(z.object({
      id: safeIdSchema,
      availableKinds: z.array(z.enum([
        "resumeDocx",
        "resumePdf",
        "coverLetterDocx",
        "coverLetterPdf",
      ])).default([]),
    }).passthrough()).max(50),
  })
  .passthrough();

export type BridgeAutofillPlan = z.infer<typeof bridgeAutofillPlanSchema>;
export type AutofillStateResponse = z.infer<typeof autofillStateResponseSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type AutofillMutationResponse = z.infer<typeof autofillMutationResponseSchema>;
export type ConsumedApprovalResponse = z.infer<
  typeof consumedApprovalResponseSchema
>;
