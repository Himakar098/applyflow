import type {
  AutofillAuthorization,
  AutofillPlan,
  InspectedField,
  SensitiveCategory,
  SubmissionApprovalProvider,
  SubmissionVerificationRequest,
  VerifiedSubmissionApproval,
} from "./types";

export class BrowserSafetyError extends Error {
  readonly code:
    | "AUTOFILL_NOT_AUTHORIZED"
    | "AUTOFILL_AUTHORIZATION_EXPIRED"
    | "FIELD_NOT_APPROVED"
    | "FIELD_REVIEW_REQUIRED"
    | "FIELD_BLOCKED"
    | "SUBMISSION_APPROVAL_REQUIRED"
    | "SUBMISSION_APPROVAL_REJECTED"
    | "SUBMISSION_APPROVAL_MISMATCH"
    | "SUBMISSION_APPROVAL_EXPIRED"
    | "CAPTCHA_DETECTED"
    | "FINAL_SUBMIT_CONTROL_NOT_UNIQUE";

  constructor(
    code: BrowserSafetyError["code"],
    message: string,
  ) {
    super(message);
    this.name = "BrowserSafetyError";
    this.code = code;
  }
}

const includesAny = (value: string, patterns: readonly string[]) =>
  patterns.some((pattern) => value.includes(pattern));

export const normaliseFieldText = (field: {
  label?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
}) =>
  [field.label, field.name, field.placeholder, field.ariaLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function classifySensitiveField(
  field: Pick<
    InspectedField,
    "label" | "name" | "placeholder" | "ariaLabel" | "kind"
  >,
): SensitiveCategory {
  const text = normaliseFieldText(field);

  if (
    includesAny(text, [
      "captcha",
      "recaptcha",
      "hcaptcha",
      "i am not a robot",
    ])
  ) {
    return "captcha";
  }

  if (
    includesAny(text, [
      "i certify",
      "i declare",
      "legal declaration",
      "legal attestation",
      "electronic signature",
      "type your signature",
      "terms and conditions",
      "privacy consent",
      "consent to a background",
      "criminal history declaration",
      "truthful and complete",
      "information is accurate",
    ])
  ) {
    return "legal_attestation";
  }

  if (
    includesAny(text, [
      "gender",
      "sex assigned",
      "sexual orientation",
      "ethnicity",
      "race",
      "racial",
      "religion",
      "marital status",
      "indigenous",
      "aboriginal",
      "torres strait",
      "disability",
      "veteran",
      "pronouns",
    ])
  ) {
    return "demographic";
  }

  if (
    includesAny(text, [
      "diversity",
      "equal opportunity",
      "eeo",
      "affirmative action",
    ])
  ) {
    return "diversity";
  }

  if (
    includesAny(text, [
      "date of birth",
      "birth date",
      "passport number",
      "tax file number",
      "tfn",
      "national id",
      "government id",
      "identity number",
      "medicare",
    ])
  ) {
    return "identity";
  }

  if (
    includesAny(text, [
      "australian citizen",
      "citizenship",
      "permanent resident",
      "permanent residency",
    ])
  ) {
    return "citizenship";
  }

  if (
    includesAny(text, [
      "visa",
      "immigration",
      "sponsorship",
      "sponsor you",
    ])
  ) {
    return "immigration";
  }

  if (
    includesAny(text, [
      "work rights",
      "working rights",
      "right to work",
      "authorised to work",
      "authorized to work",
      "work authorisation",
      "work authorization",
    ])
  ) {
    return "work_rights";
  }

  if (includesAny(text, ["security clearance", "nv1", "nv2", "baseline clearance"])) {
    return "security_clearance";
  }

  if (includesAny(text, ["driver licence", "driver license", "driving licence"])) {
    return "driver_licence";
  }

  if (
    includesAny(text, [
      "salary",
      "remuneration",
      "compensation",
      "pay expectation",
    ])
  ) {
    return "salary";
  }

  if (
    includesAny(text, [
      "availability",
      "available to start",
      "start date",
      "notice period",
    ])
  ) {
    return "availability";
  }

  return "none";
}

export const isNeverAutofillCategory = (category: SensitiveCategory) =>
  category === "captcha" ||
  category === "identity" ||
  category === "demographic" ||
  category === "diversity" ||
  category === "legal_attestation";

export const requiresPerFieldReview = (category: SensitiveCategory) =>
  category !== "none" &&
  category !== "captcha" &&
  category !== "identity" &&
  category !== "demographic" &&
  category !== "diversity" &&
  category !== "legal_attestation";

export function requireValidAutofillAuthorization(
  plan: AutofillPlan,
  authorization: AutofillAuthorization,
  now = new Date(),
): AutofillAuthorization {
  if (
    authorization.scope !== "single_application_autofill" ||
    authorization.userInitiated !== true ||
    authorization.applicationId !== plan.applicationId ||
    authorization.planId !== plan.id ||
    !authorization.approvedBy.trim() ||
    authorization.approvedFieldIds.length === 0
  ) {
    throw new BrowserSafetyError(
      "AUTOFILL_NOT_AUTHORIZED",
      "Autofill requires a matching user-initiated, per-application authorization.",
    );
  }

  const approvedAt = Date.parse(authorization.approvedAt);
  const expiresAt = Date.parse(authorization.expiresAt);
  if (
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(expiresAt) ||
    approvedAt > now.getTime() ||
    expiresAt <= now.getTime()
  ) {
    throw new BrowserSafetyError(
      "AUTOFILL_AUTHORIZATION_EXPIRED",
      "The autofill authorization is expired or has invalid timestamps.",
    );
  }

  const mappings = new Map(
    plan.mappings.map((mapping) => [mapping.field.id, mapping]),
  );
  for (const fieldId of authorization.approvedFieldIds) {
    const mapping = mappings.get(fieldId);
    if (!mapping) {
      throw new BrowserSafetyError(
        "FIELD_NOT_APPROVED",
        `Approved field ${fieldId} is not part of this plan.`,
      );
    }
    if (mapping.status === "blocked" || mapping.status === "no_match") {
      throw new BrowserSafetyError(
        "FIELD_BLOCKED",
        `Field ${mapping.field.label} cannot be filled automatically.`,
      );
    }
    if (
      mapping.reviewRequired &&
      !authorization.reviewedFieldIds.includes(fieldId)
    ) {
      throw new BrowserSafetyError(
        "FIELD_REVIEW_REQUIRED",
        `Field ${mapping.field.label} must be reviewed before autofill.`,
      );
    }
  }

  return authorization;
}

export async function requireVerifiedSubmissionApproval(
  request: SubmissionVerificationRequest,
  provider?: SubmissionApprovalProvider,
  now?: Date,
): Promise<VerifiedSubmissionApproval> {
  if (!provider) {
    throw new BrowserSafetyError(
      "SUBMISSION_APPROVAL_REQUIRED",
      "Final submission is disabled until a per-application approval provider is supplied.",
    );
  }

  const approval = await provider(request);

  if (!approval || approval.verified !== true) {
    throw new BrowserSafetyError(
      "SUBMISSION_APPROVAL_REJECTED",
      "The submission approval provider did not return a verified approval.",
    );
  }

  if (
    approval.scope !== request.scope ||
    approval.applicationId !== request.applicationId ||
    approval.planId !== request.planId ||
    approval.url !== request.url
  ) {
    throw new BrowserSafetyError(
      "SUBMISSION_APPROVAL_MISMATCH",
      "The verified approval does not match this application, plan, and page.",
    );
  }

  const approvedAt = Date.parse(approval.approvedAt);
  const expiresAt = Date.parse(approval.expiresAt);
  const verificationTime = now?.getTime() ?? Date.now();

  if (
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(expiresAt) ||
    approvedAt > verificationTime ||
    expiresAt <= verificationTime
  ) {
    throw new BrowserSafetyError(
      "SUBMISSION_APPROVAL_EXPIRED",
      "The verified submission approval is expired or has invalid timestamps.",
    );
  }

  if (!approval.verificationId.trim() || !approval.approvedBy.trim()) {
    throw new BrowserSafetyError(
      "SUBMISSION_APPROVAL_REJECTED",
      "The verified approval is missing its verifier identity.",
    );
  }

  return approval;
}
