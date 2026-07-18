export const portalKinds = [
  "generic",
  "greenhouse",
  "lever",
  "workday",
  "smartrecruiters",
  "successfactors",
  "pageup",
  "ashby",
] as const;

export type PortalKind = (typeof portalKinds)[number];

export type AdapterSupport = "supported" | "prototype" | "stub";

export type ApplicationApprovalState =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED_FOR_AUTOFILL"
  | "AUTOFILL_IN_PROGRESS"
  | "AUTOFILL_PAUSED"
  | "READY_TO_SUBMIT"
  | "SUBMISSION_APPROVED"
  | "SUBMITTED"
  | "FAILED"
  | "WITHDRAWN";

export type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "file"
  | "password"
  | "unknown";

export type SensitiveCategory =
  | "none"
  | "captcha"
  | "work_rights"
  | "immigration"
  | "citizenship"
  | "security_clearance"
  | "driver_licence"
  | "salary"
  | "availability"
  | "identity"
  | "demographic"
  | "diversity"
  | "legal_attestation"
  | "unknown_question";

export type ClaimProvenance =
  | "verified"
  | "user-entered"
  | "needs-confirmation"
  | "prohibited-from-inference";

export interface FieldOption {
  label: string;
  value: string;
}

export interface InspectedField {
  id: string;
  selector: string;
  label: string;
  name: string;
  kind: FieldKind;
  required: boolean;
  disabled: boolean;
  visible: boolean;
  /** Whether the current control already has a value, without exposing that value. */
  hasValue: boolean;
  placeholder?: string;
  ariaLabel?: string;
  autocomplete?: string;
  options?: FieldOption[];
  sensitiveCategory: SensitiveCategory;
  reviewRequired: boolean;
}

export interface SubmitControl {
  id: string;
  selector: string;
  label: string;
  visible: boolean;
  disabled: boolean;
}

export type PauseReasonCode =
  | "CAPTCHA_DETECTED"
  | "LEGAL_ATTESTATION"
  | "SENSITIVE_DEMOGRAPHIC_FIELD"
  | "IDENTITY_DECLARATION"
  | "UNKNOWN_REQUIRED_QUESTION"
  | "UNSUPPORTED_PORTAL"
  | "USER_REVIEW_REQUIRED";

export interface PauseSignal {
  code: PauseReasonCode;
  message: string;
  fieldId?: string;
  severity: "pause" | "review";
}

export interface FormInspection {
  url: string;
  title: string;
  portal: PortalKind;
  adapterSupport: AdapterSupport;
  inspectedAt: string;
  captchaDetected: boolean;
  fields: InspectedField[];
  submitControls: SubmitControl[];
  pauses: PauseSignal[];
}

export interface VisibleJobExtraction {
  portal: PortalKind;
  sourceUrl: string;
  title?: string;
  company?: string;
  location?: string;
  descriptionText?: string;
  extractedAt: string;
}

export interface AutofillValue {
  /** A stable profile key such as `email`, `firstName`, or `workRights`. */
  key: string;
  value: string | number | boolean;
  sourceLabel: string;
  provenance: ClaimProvenance;
  aliases?: string[];
}

export interface CandidateAutofillProfile {
  values: AutofillValue[];
  documents?: {
    resumePath?: string;
    coverLetterPath?: string;
  };
}

export type FieldMappingStatus =
  | "ready"
  | "needs_review"
  | "blocked"
  | "no_match";

export interface FieldMapping {
  field: InspectedField;
  profileKey?: string;
  proposedValue?: string | number | boolean;
  sourceLabel?: string;
  provenance?: ClaimProvenance;
  confidence: number;
  reviewRequired: boolean;
  status: FieldMappingStatus;
  reason?: string;
}

export interface AutofillPlan {
  id: string;
  applicationId: string;
  url: string;
  portal: PortalKind;
  createdAt: string;
  state: "READY_FOR_REVIEW";
  mappings: FieldMapping[];
  pauses: PauseSignal[];
  submitControls: SubmitControl[];
}

export interface AutofillAuthorization {
  scope: "single_application_autofill";
  applicationId: string;
  planId: string;
  approvedFieldIds: string[];
  reviewedFieldIds: string[];
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  /** Must only be set by the explicit Start autofill UI action. */
  userInitiated: true;
}

export interface AutofillResult {
  applicationId: string;
  planId: string;
  state: "AUTOFILL_PAUSED" | "READY_TO_SUBMIT";
  filledFieldIds: string[];
  skippedFieldIds: string[];
  pauses: PauseSignal[];
  screenshotPath?: string;
}

export interface SubmissionVerificationRequest {
  scope: "single_application_submit";
  applicationId: string;
  planId: string;
  url: string;
  requestedAt: string;
}

export interface VerifiedSubmissionApproval {
  scope: "single_application_submit";
  applicationId: string;
  planId: string;
  url: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  verificationId: string;
  verified: true;
}

export type SubmissionApprovalProvider = (
  request: SubmissionVerificationRequest,
) => Promise<VerifiedSubmissionApproval | null>;

export interface SubmissionResult {
  applicationId: string;
  planId: string;
  portal: PortalKind;
  state: "SUBMITTED" | "SUBMISSION_UNCONFIRMED";
  verificationId: string;
  attemptedAt: string;
  submittedAt?: string;
  confirmationEvidence: string[];
  /** Adapter evidence used by the authenticated receipt reporter. */
  confirmation: SubmissionConfirmation;
  screenshotPath?: string;
}

export interface SubmissionConfirmation {
  confirmed: boolean;
  finalUrl: string;
  evidence: string[];
  matchedSignals: Array<
    | "success_url"
    | "confirmation_heading"
    | "receipt_identifier"
    | "submit_control_absent"
    | "no_validation_errors"
  >;
  noValidationErrors: boolean;
  portalReceiptId?: string;
}

export interface BrowserCapture {
  url: string;
  title: string;
  portal: PortalKind;
  capturedAt: string;
  screenshotPath: string;
}

export interface BrowserPageState {
  url: string;
  title: string;
  portal: PortalKind;
  adapterSupport: AdapterSupport;
  captchaDetected: boolean;
  visibleFieldCount: number;
  submitControlCount: number;
  reportedAt: string;
}

export interface BrowserBridge {
  captureCurrentPage(): Promise<BrowserCapture>;
  extractVisibleJob(): Promise<VisibleJobExtraction>;
  inspectForm(): Promise<FormInspection>;
  requestAutofillPlan(
    applicationId: string,
    profile: CandidateAutofillProfile,
  ): Promise<AutofillPlan>;
  fillApprovedFields(
    plan: AutofillPlan,
    authorization: AutofillAuthorization,
  ): Promise<AutofillResult>;
  reportPageState(): Promise<BrowserPageState>;
}

export interface BrowserActivityEvent {
  timestamp: string;
  action:
    | "browser_started"
    | "page_opened"
    | "page_captured"
    | "form_inspected"
    | "autofill_started"
    | "field_filled"
    | "autofill_paused"
    | "ready_to_submit"
    | "submission_verified"
    | "submission_unconfirmed"
    | "submitted"
    | "browser_closed";
  message: string;
  applicationId?: string;
  fieldId?: string;
}

export type BrowserActivitySink = (
  event: BrowserActivityEvent,
) => void | Promise<void>;
