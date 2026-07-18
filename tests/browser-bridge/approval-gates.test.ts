import assert from "node:assert/strict";
import { test } from "vitest";

import {
  BrowserSafetyError,
  requireValidAutofillAuthorization,
  requireVerifiedSubmissionApproval,
} from "../../packages/browser-bridge/src/safety";
import type {
  AutofillAuthorization,
  AutofillPlan,
  SubmissionVerificationRequest,
  VerifiedSubmissionApproval,
} from "../../packages/browser-bridge/src/types";

const now = new Date("2026-07-18T04:00:00.000Z");
const request: SubmissionVerificationRequest = {
  scope: "single_application_submit",
  applicationId: "application-1",
  planId: "plan-1",
  url: "http://localhost:3000/job-agent-fixtures/generic.html",
  requestedAt: now.toISOString(),
};

const validApproval: VerifiedSubmissionApproval = {
  scope: "single_application_submit",
  applicationId: request.applicationId,
  planId: request.planId,
  url: request.url,
  approvedBy: "local-user",
  approvedAt: "2026-07-18T03:59:00.000Z",
  expiresAt: "2026-07-18T04:04:00.000Z",
  verificationId: "verification-1",
  verified: true,
};

const plan: AutofillPlan = {
  id: "plan-1",
  applicationId: "application-1",
  url: request.url,
  portal: "generic",
  createdAt: "2026-07-18T03:58:00.000Z",
  state: "READY_FOR_REVIEW",
  mappings: [
    {
      field: {
        id: "email",
        selector: "#email",
        label: "Email",
        name: "email",
        kind: "email",
        required: true,
        disabled: false,
        visible: true,
        hasValue: false,
        sensitiveCategory: "none",
        reviewRequired: false,
      },
      profileKey: "email",
      proposedValue: "local-fixture@example.test",
      sourceLabel: "Private profile",
      provenance: "user-entered",
      confidence: 0.99,
      reviewRequired: false,
      status: "ready",
    },
    {
      field: {
        id: "work-rights",
        selector: "#work-rights",
        label: "Full working rights in Australia?",
        name: "work_rights",
        kind: "select",
        required: true,
        disabled: false,
        visible: true,
        hasValue: false,
        sensitiveCategory: "work_rights",
        reviewRequired: true,
      },
      profileKey: "workRights",
      proposedValue: true,
      sourceLabel: "Verified claim",
      provenance: "verified",
      confidence: 0.9,
      reviewRequired: true,
      status: "needs_review",
    },
  ],
  pauses: [],
  submitControls: [],
};

test("autofill fails without a user-initiated matching authorization", () => {
  const authorization = {
    scope: "single_application_autofill",
    applicationId: plan.applicationId,
    planId: plan.id,
    approvedFieldIds: ["email"],
    reviewedFieldIds: [],
    approvedBy: "local-user",
    approvedAt: "2026-07-18T03:59:00.000Z",
    expiresAt: "2026-07-18T04:04:00.000Z",
    userInitiated: false,
  } as unknown as AutofillAuthorization;

  assert.throws(
    () => requireValidAutofillAuthorization(plan, authorization, now),
    (error: unknown) =>
      error instanceof BrowserSafetyError &&
      error.code === "AUTOFILL_NOT_AUTHORIZED",
  );
});

test("review-sensitive fields need an explicit reviewed-field decision", () => {
  const authorization: AutofillAuthorization = {
    scope: "single_application_autofill",
    applicationId: plan.applicationId,
    planId: plan.id,
    approvedFieldIds: ["work-rights"],
    reviewedFieldIds: [],
    approvedBy: "local-user",
    approvedAt: "2026-07-18T03:59:00.000Z",
    expiresAt: "2026-07-18T04:04:00.000Z",
    userInitiated: true,
  };

  assert.throws(
    () => requireValidAutofillAuthorization(plan, authorization, now),
    (error: unknown) =>
      error instanceof BrowserSafetyError &&
      error.code === "FIELD_REVIEW_REQUIRED",
  );

  assert.doesNotThrow(() =>
    requireValidAutofillAuthorization(
      plan,
      { ...authorization, reviewedFieldIds: ["work-rights"] },
      now,
    ),
  );
});

test("final submission fails closed when no approval provider exists", async () => {
  await assert.rejects(
    () => requireVerifiedSubmissionApproval(request, undefined, now),
    (error: unknown) =>
      error instanceof BrowserSafetyError &&
      error.code === "SUBMISSION_APPROVAL_REQUIRED",
  );
});

test("final submission rejects an approval for another application", async () => {
  await assert.rejects(
    () =>
      requireVerifiedSubmissionApproval(
        request,
        async () => ({ ...validApproval, applicationId: "application-2" }),
        now,
      ),
    (error: unknown) =>
      error instanceof BrowserSafetyError &&
      error.code === "SUBMISSION_APPROVAL_MISMATCH",
  );
});

test("final submission accepts only a current, exactly matching verified approval", async () => {
  const approval = await requireVerifiedSubmissionApproval(
    request,
    async () => validApproval,
    now,
  );

  assert.equal(approval.verificationId, "verification-1");
  assert.equal(approval.applicationId, request.applicationId);
  assert.equal(approval.planId, request.planId);
});
