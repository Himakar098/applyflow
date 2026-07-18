import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { isCredentialFreeHttpUrl } from "@/lib/security/url-policy";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const safeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const portalSchema = z.enum([
  "generic",
  "greenhouse",
  "lever",
  "workday",
  "smartrecruiters",
  "successfactors",
  "pageup",
  "ashby",
]);
const confirmationRuleSchema = z.enum([
  "generic_confirmation_screen_v1",
  "greenhouse_confirmation_page_v1",
  "lever_confirmation_page_v1",
]);
const matchedSignalSchema = z.enum([
  "success_url",
  "confirmation_heading",
  "receipt_identifier",
  "submit_control_absent",
  "no_validation_errors",
]);

const observedUrlSchema = z.string().trim().url().max(2_000).refine(
  isCredentialFreeHttpUrl,
  "Observed URL must use credential-free HTTP or HTTPS",
).transform((value) => {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
});

export const submissionResultInputSchema = z.object({
  attemptId: safeIdSchema,
  completionToken: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  planHash: sha256Schema,
  outcome: z.enum(["confirmed", "unknown", "failed"]),
  observedAt: z.string().datetime({ offset: true }),
  observedUrl: observedUrlSchema,
  portal: portalSchema,
  verification: z.object({
    ruleId: confirmationRuleSchema.optional(),
    matchedSignals: z.array(matchedSignalSchema).max(8).default([]),
    noValidationErrors: z.boolean(),
    confirmationTextSha256: sha256Schema.optional(),
    screenshotSha256: sha256Schema.optional(),
    portalReceiptId: z.string().trim().min(1).max(300).optional(),
  }).strict(),
}).strict();

export const manualSubmissionResolutionSchema = z.object({
  attemptId: safeIdSchema,
  resolution: z.enum(["submitted", "not_submitted"]),
  explicitUserConfirmation: z.literal(true),
  confirmedAt: z.string().datetime({ offset: true }),
}).strict();

/** Backwards-compatible export name for callers created before both outcomes were supported. */
export const manualSubmissionConfirmationSchema = manualSubmissionResolutionSchema;

export const submissionAttemptSchema = z.object({
  id: safeIdSchema,
  applicationId: safeIdSchema,
  approvalId: safeIdSchema,
  planHash: sha256Schema,
  completionTokenHash: sha256Schema.nullable(),
  status: z.enum([
    "pending",
    "confirmed",
    "unknown",
    "failed",
    "manually_confirmed",
    "manually_not_submitted",
  ]),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  result: z.object({
    outcome: z.enum(["confirmed", "unknown", "failed"]),
    observedAt: z.string().datetime({ offset: true }),
    observedUrl: observedUrlSchema,
    portal: portalSchema,
    ruleId: confirmationRuleSchema.nullable(),
    matchedSignals: z.array(matchedSignalSchema).max(8),
    confirmationTextSha256: sha256Schema.nullable(),
    screenshotSha256: sha256Schema.nullable(),
    portalReceiptId: z.string().trim().min(1).max(300).nullable(),
  }).strict().nullable(),
});

export type SubmissionResultInput = z.infer<typeof submissionResultInputSchema>;
export type SubmissionAttempt = z.infer<typeof submissionAttemptSchema>;
export type ManualSubmissionResolution = z.infer<typeof manualSubmissionResolutionSchema>;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sameDigest(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSubmissionAttempt(input: {
  applicationId: string;
  approvalId: string;
  planHash: string;
  issuedAt: string;
  approvalExpiresAt?: string | null;
  lifetimeMs?: number;
}) {
  const completionToken = randomBytes(32).toString("base64url");
  const requestedExpiry = Date.parse(input.issuedAt) + (input.lifetimeMs ?? 5 * 60_000);
  const approvalExpiry = input.approvalExpiresAt
    ? Date.parse(input.approvalExpiresAt)
    : requestedExpiry;
  const expiresAt = new Date(Math.min(requestedExpiry, approvalExpiry)).toISOString();
  const attempt = submissionAttemptSchema.parse({
    id: `attempt-${crypto.randomUUID()}`,
    applicationId: input.applicationId,
    approvalId: input.approvalId,
    planHash: input.planHash,
    completionTokenHash: sha256(completionToken),
    status: "pending",
    issuedAt: input.issuedAt,
    expiresAt,
    completedAt: null,
    result: null,
  });
  return { attempt, completionToken };
}

function expectedRule(portal: SubmissionResultInput["portal"]) {
  if (portal === "greenhouse") return "greenhouse_confirmation_page_v1" as const;
  if (portal === "lever") return "lever_confirmation_page_v1" as const;
  if (portal === "generic") return "generic_confirmation_screen_v1" as const;
  return null;
}

function hostnameMatchesPortal(
  applicationUrl: string,
  observedUrl: string,
  portal: SubmissionResultInput["portal"],
) {
  const expected = new URL(applicationUrl);
  const observed = new URL(observedUrl);
  if (expected.origin === observed.origin) return true;
  const isHostOrSubdomain = (hostname: string, base: string) =>
    hostname === base || hostname.endsWith(`.${base}`);
  if (portal === "greenhouse") {
    return isHostOrSubdomain(expected.hostname, "greenhouse.io")
      && isHostOrSubdomain(observed.hostname, "greenhouse.io");
  }
  if (portal === "lever") {
    return isHostOrSubdomain(expected.hostname, "lever.co")
      && isHostOrSubdomain(observed.hostname, "lever.co");
  }
  return false;
}

/**
 * Verifies replay protection and the worker's adapter-specific confirmation
 * receipt. The caller still must enforce the separately authenticated worker
 * channel before accepting the result.
 */
export function consumeSubmissionResult(input: {
  attempt: SubmissionAttempt;
  result: SubmissionResultInput;
  applicationUrl: string;
  now: string;
}) {
  const attempt = submissionAttemptSchema.parse(input.attempt);
  const result = submissionResultInputSchema.parse(input.result);
  if (attempt.status !== "pending" || !attempt.completionTokenHash) {
    throw new Error("The submission completion receipt has already been consumed.");
  }
  if (attempt.id !== result.attemptId || attempt.planHash !== result.planHash) {
    throw new Error("The submission result does not match this attempt and plan.");
  }
  if (!sameDigest(attempt.completionTokenHash, sha256(result.completionToken))) {
    throw new Error("The submission completion receipt is invalid.");
  }
  const now = Date.parse(input.now);
  const observedAt = Date.parse(result.observedAt);
  if (
    now > Date.parse(attempt.expiresAt)
    || observedAt < Date.parse(attempt.issuedAt) - 30_000
    || observedAt > now + 30_000
  ) {
    throw new Error("The submission completion receipt has expired or has invalid timing.");
  }

  if (result.outcome === "confirmed") {
    const rule = expectedRule(result.portal);
    if (!rule || result.verification.ruleId !== rule) {
      throw new Error("This portal has no recognized submission confirmation verifier.");
    }
    const signals = new Set(result.verification.matchedSignals);
    const hasConfirmationSignal = signals.has("confirmation_heading")
      || signals.has("receipt_identifier")
      || signals.has("success_url");
    if (
      !result.verification.noValidationErrors
      || !signals.has("no_validation_errors")
      || !signals.has("submit_control_absent")
      || !hasConfirmationSignal
      || !result.verification.confirmationTextSha256
      || !result.verification.screenshotSha256
    ) {
      throw new Error("The worker did not provide complete portal success evidence.");
    }
    if (!hostnameMatchesPortal(input.applicationUrl, result.observedUrl, result.portal)) {
      throw new Error("The observed confirmation page does not match the application portal.");
    }
  }

  return submissionAttemptSchema.parse({
    ...attempt,
    completionTokenHash: null,
    status: result.outcome,
    completedAt: input.now,
    result: {
      outcome: result.outcome,
      observedAt: result.observedAt,
      observedUrl: result.observedUrl,
      portal: result.portal,
      ruleId: result.verification.ruleId ?? null,
      matchedSignals: result.verification.matchedSignals,
      confirmationTextSha256: result.verification.confirmationTextSha256 ?? null,
      screenshotSha256: result.verification.screenshotSha256 ?? null,
      portalReceiptId: result.verification.portalReceiptId ?? null,
    },
  });
}

export function submissionAttemptView(attempt: SubmissionAttempt | null | undefined) {
  if (!attempt) return null;
  const parsed = submissionAttemptSchema.parse(attempt);
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== "completionTokenHash"),
  ) as Omit<SubmissionAttempt, "completionTokenHash">;
}
