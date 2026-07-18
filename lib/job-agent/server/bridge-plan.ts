import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import {
  autofillPlanSchema,
  type AutofillPlan,
} from "@/lib/job-agent";
import { isCredentialFreeHttpUrl } from "@/lib/security/url-policy";

const inspectedFieldSchema = z.object({
  id: z.string().min(1).max(300),
  selector: z.string().min(1).max(2_000),
  label: z.string().min(1).max(500),
  name: z.string().max(500),
  kind: z.enum([
    "text", "email", "tel", "url", "number", "date", "textarea",
    "select", "checkbox", "radio", "file", "password", "unknown",
  ]),
  required: z.boolean(),
  disabled: z.boolean(),
  visible: z.boolean(),
  hasValue: z.boolean(),
  sensitiveCategory: z.enum([
    "none", "captcha", "work_rights", "immigration", "citizenship",
    "security_clearance", "driver_licence", "salary", "availability",
    "identity", "demographic", "diversity", "legal_attestation",
    "unknown_question",
  ]),
  reviewRequired: z.boolean(),
  placeholder: z.string().max(500).optional(),
  ariaLabel: z.string().max(500).optional(),
  autocomplete: z.string().max(200).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).max(500).optional(),
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

export const bridgeAutofillPlanSchema = z.object({
  id: z.string().min(1).max(300),
  applicationId: z.string().min(1).max(120),
  url: z.string().url().max(2_000).refine(
    isCredentialFreeHttpUrl,
    "Autofill URL must use credential-free HTTP or HTTPS",
  ),
  portal: z.enum([
    "generic", "greenhouse", "lever", "workday", "smartrecruiters",
    "successfactors", "pageup", "ashby",
  ]),
  createdAt: z.string().min(1).max(100),
  state: z.literal("READY_FOR_REVIEW"),
  mappings: z.array(z.object({
    field: inspectedFieldSchema,
    profileKey: z.string().max(300).optional(),
    proposedValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    sourceLabel: z.string().max(500).optional(),
    provenance: z.enum([
      "verified", "user-entered", "needs-confirmation", "prohibited-from-inference",
    ]).optional(),
    confidence: z.number().min(0).max(1),
    reviewRequired: z.boolean(),
    status: z.enum(["ready", "needs_review", "blocked", "no_match"]),
    reason: z.string().max(2_000).optional(),
  })).max(500),
  pauses: z.array(pauseSchema).max(500),
  submitControls: z.array(z.object({
    id: z.string().min(1).max(300),
    selector: z.string().min(1).max(2_000),
    label: z.string().min(1).max(500),
    visible: z.boolean(),
    disabled: z.boolean(),
  })).max(20),
}).strict().superRefine((plan, ctx) => {
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

export type BridgeAutofillPlan = z.infer<typeof bridgeAutofillPlanSchema>;
export type AcceptedAutofillPlan = AutofillPlan | BridgeAutofillPlan;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function isBridgeAutofillPlan(value: AcceptedAutofillPlan): value is BridgeAutofillPlan {
  return "mappings" in value;
}

function challengeFor(category: BridgeAutofillPlan["mappings"][number]["field"]["sensitiveCategory"]) {
  if (category === "captcha") return "captcha" as const;
  if (category === "legal_attestation") return "legal-declaration" as const;
  if (category === "demographic" || category === "diversity") return "sensitive-demographic" as const;
  if (["work_rights", "immigration", "citizenship", "security_clearance", "driver_licence", "identity"].includes(category)) {
    return "identity-declaration" as const;
  }
  return null;
}

export function normalizeAutofillPlan(
  input: AcceptedAutofillPlan,
  approvals: { approvedFieldIds?: string[]; reviewedFieldIds?: string[] } = {},
) {
  if (!isBridgeAutofillPlan(input)) {
    return { plan: autofillPlanSchema.parse(input), bridgePlan: null };
  }
  const bridgePlan = bridgeAutofillPlanSchema.parse(input);
  const approved = new Set(approvals.approvedFieldIds ?? []);
  const reviewed = new Set(approvals.reviewedFieldIds ?? []);
  const bridgeHash = createHash("sha256")
    .update(JSON.stringify(stableValue(bridgePlan)))
    .digest("hex");
  const mappingById = new Map(
    bridgePlan.mappings.map((mapping) => [mapping.field.id, mapping]),
  );
  const isSelectedOrRequired = (mapping: BridgeAutofillPlan["mappings"][number]) =>
    mapping.field.required || approved.has(mapping.field.id);
  const unknownQuestions = [
    ...bridgePlan.mappings
      .filter((mapping) =>
        (mapping.status === "no_match" || mapping.status === "blocked")
        && isSelectedOrRequired(mapping)
        && !reviewed.has(mapping.field.id),
      )
      .map((mapping) => mapping.field.label),
    ...bridgePlan.pauses
      .filter((pause) =>
        (pause.code === "UNKNOWN_REQUIRED_QUESTION" || pause.code === "UNSUPPORTED_PORTAL")
        && (!pause.fieldId || (
          mappingById.has(pause.fieldId)
          && isSelectedOrRequired(mappingById.get(pause.fieldId)!)
        ))
        && (!pause.fieldId || !reviewed.has(pause.fieldId)),
      )
      .map((pause) => pause.message),
  ].filter((value, index, all) => all.indexOf(value) === index);
  const detectedChallenges = [
    ...bridgePlan.mappings
      .filter((mapping) =>
        isSelectedOrRequired(mapping) && !reviewed.has(mapping.field.id),
      )
      .map((mapping) => challengeFor(mapping.field.sensitiveCategory))
      .filter(Boolean),
    ...bridgePlan.pauses.filter((pause) => {
      const mapping = pause.fieldId ? mappingById.get(pause.fieldId) : undefined;
      return (!mapping || isSelectedOrRequired(mapping))
        && (!pause.fieldId || !reviewed.has(pause.fieldId));
    }).map((pause) => {
      if (pause.code === "CAPTCHA_DETECTED") return "captcha" as const;
      if (pause.code === "LEGAL_ATTESTATION") return "legal-declaration" as const;
      if (pause.code === "SENSITIVE_DEMOGRAPHIC_FIELD") return "sensitive-demographic" as const;
      if (pause.code === "IDENTITY_DECLARATION") return "identity-declaration" as const;
      return null;
    }).filter(Boolean),
  ].filter((value, index, all) => all.indexOf(value) === index);

  const plan = autofillPlanSchema.parse({
    id: `${bridgePlan.id}-${bridgeHash.slice(0, 16)}`,
    applicationId: bridgePlan.applicationId,
    fields: bridgePlan.mappings.map((mapping) => {
      const selectedOrRequired = isSelectedOrRequired(mapping);
      const requiresUserReview = selectedOrRequired && (
        mapping.reviewRequired
        || mapping.field.reviewRequired
        || mapping.status !== "ready"
      );
      const hasExplicitApproval = approved.has(mapping.field.id)
        && (!requiresUserReview || reviewed.has(mapping.field.id));
      return {
        id: mapping.field.id,
        label: mapping.field.label,
        detectedFieldType: mapping.field.kind,
        proposedValue: mapping.proposedValue === undefined ? "" : String(mapping.proposedValue),
        source: `${mapping.sourceLabel ?? mapping.profileKey ?? "manual review"} | ${mapping.field.selector}`,
        confidence: mapping.confidence,
        requiresUserReview,
        approved: hasExplicitApproval,
        sensitive: mapping.field.sensitiveCategory !== "none",
      };
    }),
    documentUploads: [],
    unknownQuestions,
    detectedChallenges,
    createdAt: bridgePlan.createdAt,
  });
  return { plan, bridgePlan };
}
