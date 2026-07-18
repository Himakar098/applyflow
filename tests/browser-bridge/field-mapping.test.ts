import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildAutofillPlan,
  mapField,
} from "../../packages/browser-bridge/src/field-mapping";
import { classifySensitiveField } from "../../packages/browser-bridge/src/safety";
import type {
  CandidateAutofillProfile,
  FormInspection,
  InspectedField,
} from "../../packages/browser-bridge/src/types";

const profile: CandidateAutofillProfile = {
  values: [
    {
      key: "firstName",
      value: "Himakar",
      sourceLabel: "Verified candidate profile",
      provenance: "verified",
    },
    {
      key: "email",
      value: "local-fixture@example.test",
      sourceLabel: "Private candidate profile",
      provenance: "user-entered",
    },
    {
      key: "workRights",
      value: true,
      sourceLabel: "Verified visa and work-rights claim",
      provenance: "verified",
    },
    {
      key: "citizenship",
      value: false,
      sourceLabel: "Truth rule",
      provenance: "prohibited-from-inference",
    },
  ],
};

function field(
  id: string,
  label: string,
  overrides: Partial<InspectedField> = {},
): InspectedField {
  return {
    id,
    selector: `[data-field="${id}"]`,
    label,
    name: id,
    kind: "text",
    required: true,
    disabled: false,
    visible: true,
    hasValue: false,
    sensitiveCategory: "none",
    reviewRequired: false,
    ...overrides,
  };
}

test("maps ordinary fields with value provenance", () => {
  const mapping = mapField(field("email", "Email address"), profile);

  assert.equal(mapping.status, "ready");
  assert.equal(mapping.proposedValue, "local-fixture@example.test");
  assert.equal(mapping.sourceLabel, "Private candidate profile");
  assert.equal(mapping.provenance, "user-entered");
  assert.equal(mapping.reviewRequired, false);
  assert.ok(mapping.confidence >= 0.98);
});

test("work-right answers are mapped but always require per-field review", () => {
  const mapping = mapField(
    field("rights", "Do you have full working rights in Australia?", {
      kind: "select",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
    }),
    profile,
  );

  assert.equal(mapping.status, "needs_review");
  assert.equal(mapping.proposedValue, true);
  assert.equal(mapping.field.sensitiveCategory, "work_rights");
  assert.equal(mapping.reviewRequired, true);
});

test("demographic and legal fields are never assigned proposed values", () => {
  const demographic = mapField(field("gender", "Gender (optional)"), profile);
  const legal = mapField(
    field("declare", "I declare that the information is accurate", {
      kind: "checkbox",
    }),
    profile,
  );

  assert.equal(demographic.status, "blocked");
  assert.equal(demographic.proposedValue, undefined);
  assert.equal(demographic.field.sensitiveCategory, "demographic");
  assert.equal(legal.status, "blocked");
  assert.equal(legal.proposedValue, undefined);
  assert.equal(legal.field.sensitiveCategory, "legal_attestation");
});

test("prohibited-from-inference claims cannot be autofilled", () => {
  const mapping = mapField(
    field("citizenship", "Australian citizenship"),
    profile,
  );

  assert.equal(mapping.status, "blocked");
  assert.equal(mapping.proposedValue, undefined);
  assert.match(mapping.reason ?? "", /prohibited from inference/i);
});

test("plan records CAPTCHA and required unknown-question pauses", () => {
  const inspection: FormInspection = {
    url: "http://localhost:3000/job-agent-fixtures/generic.html",
    title: "Fixture",
    portal: "generic",
    adapterSupport: "supported",
    inspectedAt: "2026-07-18T00:00:00.000Z",
    captchaDetected: true,
    fields: [
      field("first", "First name"),
      field("unknown", "Explain anything else we should know", {
        kind: "textarea",
      }),
    ],
    submitControls: [],
    pauses: [
      {
        code: "CAPTCHA_DETECTED",
        message: "CAPTCHA visible",
        severity: "pause",
      },
    ],
  };

  const plan = buildAutofillPlan(
    "application-1",
    inspection,
    profile,
    new Date("2026-07-18T00:01:00.000Z"),
  );

  assert.equal(plan.state, "READY_FOR_REVIEW");
  assert.equal(plan.mappings[0].status, "ready");
  assert.equal(plan.mappings[1].status, "no_match");
  assert.ok(plan.pauses.some((pause) => pause.code === "CAPTCHA_DETECTED"));
  assert.ok(
    plan.pauses.some(
      (pause) =>
        pause.code === "UNKNOWN_REQUIRED_QUESTION" &&
        pause.fieldId === "unknown",
    ),
  );
});

test("sensitive classifier covers identity and CAPTCHA markers", () => {
  assert.equal(
    classifySensitiveField(field("passport", "Passport number")),
    "identity",
  );
  assert.equal(
    classifySensitiveField(field("captcha", "I am not a robot")),
    "captcha",
  );
});
