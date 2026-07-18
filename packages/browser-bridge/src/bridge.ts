import { resolvePortalAdapter } from "./adapters";
import {
  UnsupportedPortalError,
  type PortalAdapter,
} from "./adapters/types";
import { buildAutofillPlan } from "./field-mapping";
import type { BrowserLocator, BrowserPage } from "./runtime-types";
import {
  BrowserSafetyError,
  requireValidAutofillAuthorization,
  requireVerifiedSubmissionApproval,
} from "./safety";
import type {
  AutofillAuthorization,
  AutofillPlan,
  AutofillResult,
  BrowserActivityEvent,
  BrowserActivitySink,
  BrowserBridge,
  BrowserCapture,
  BrowserPageState,
  CandidateAutofillProfile,
  FieldMapping,
  FormInspection,
  PauseSignal,
  SubmissionApprovalProvider,
  SubmissionConfirmation,
  SubmissionResult,
  VisibleJobExtraction,
} from "./types";
import {
  LocalPlaywrightWorker,
  type LocalPlaywrightWorkerOptions,
} from "./worker";

export interface LocalPlaywrightBrowserBridgeOptions
  extends LocalPlaywrightWorkerOptions {
  worker?: LocalPlaywrightWorker;
  adapters?: PortalAdapter[];
}

const normaliseOption = (value: string | number | boolean) =>
  String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

async function fillMapping(locator: BrowserLocator, mapping: FieldMapping) {
  const value = mapping.proposedValue;
  if (value === undefined) {
    throw new BrowserSafetyError(
      "FIELD_BLOCKED",
      `Field ${mapping.field.label} has no approved value.`,
    );
  }

  switch (mapping.field.kind) {
    case "file":
      await locator.setInputFiles(String(value));
      return;
    case "select": {
      const wanted = normaliseOption(value);
      const option = mapping.field.options?.find(
        (candidate) =>
          normaliseOption(candidate.label) === wanted ||
          normaliseOption(candidate.value) === wanted ||
          (value === true && normaliseOption(candidate.label) === "yes") ||
          (value === false && normaliseOption(candidate.label) === "no"),
      );
      if (!option) {
        throw new BrowserSafetyError(
          "FIELD_REVIEW_REQUIRED",
          `No exact option matches the approved value for ${mapping.field.label}.`,
        );
      }
      await locator.selectOption(option.value);
      return;
    }
    case "checkbox":
      if (typeof value !== "boolean") {
        throw new BrowserSafetyError(
          "FIELD_REVIEW_REQUIRED",
          `Checkbox ${mapping.field.label} needs an explicit boolean answer.`,
        );
      }
      if (value) await locator.check();
      else await locator.uncheck();
      return;
    case "radio": {
      const label = normaliseOption(mapping.field.label);
      const shouldSelect =
        normaliseOption(value) === label ||
        (value === true && (label.endsWith("yes") || label === "yes")) ||
        (value === false && (label.endsWith("no") || label === "no"));
      if (!shouldSelect) {
        throw new BrowserSafetyError(
          "FIELD_REVIEW_REQUIRED",
          `Radio option ${mapping.field.label} does not exactly match the approved answer.`,
        );
      }
      await locator.check();
      return;
    }
    case "password":
    case "unknown":
      throw new BrowserSafetyError(
        "FIELD_BLOCKED",
        `${mapping.field.kind} fields are reserved for manual completion.`,
      );
    default:
      await locator.fill(String(value));
  }
}

export class LocalPlaywrightBrowserBridge implements BrowserBridge {
  readonly worker: LocalPlaywrightWorker;

  private readonly adapters?: PortalAdapter[];
  private readonly activitySink?: BrowserActivitySink;

  constructor(options: LocalPlaywrightBrowserBridgeOptions = {}) {
    this.activitySink = options.activitySink;
    this.worker = options.worker ?? new LocalPlaywrightWorker(options);
    this.adapters = options.adapters;
  }

  private async emit(event: Omit<BrowserActivityEvent, "timestamp">) {
    await this.activitySink?.({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  async open(url: string): Promise<void> {
    await this.worker.open(url);
  }

  private async pageAndAdapter(): Promise<{
    page: BrowserPage;
    adapter: PortalAdapter;
  }> {
    const page = await this.worker.page();
    const adapter = await resolvePortalAdapter(page, this.adapters);
    return { page, adapter };
  }

  async captureCurrentPage(): Promise<BrowserCapture> {
    const { page, adapter } = await this.pageAndAdapter();
    const title = await page.title();
    const screenshotPath = await this.worker.screenshot(
      `${adapter.kind}-${title || "capture"}`,
    );
    const capture = {
      url: page.url(),
      title,
      portal: adapter.kind,
      capturedAt: new Date().toISOString(),
      screenshotPath,
    };
    await this.emit({
      action: "page_captured",
      message: `Captured ${adapter.label} page to ${screenshotPath}`,
    });
    return capture;
  }

  async extractVisibleJob(): Promise<VisibleJobExtraction> {
    const { page, adapter } = await this.pageAndAdapter();
    return adapter.extractVisibleJob(page);
  }

  async inspectForm(): Promise<FormInspection> {
    const { page, adapter } = await this.pageAndAdapter();

    try {
      const inspection = await adapter.inspectForm(page);
      await this.emit({
        action: "form_inspected",
        message: `Inspected ${inspection.fields.length} visible fields on ${adapter.label}.`,
      });
      return inspection;
    } catch (error) {
      if (!(error instanceof UnsupportedPortalError)) throw error;
      return {
        url: page.url(),
        title: await page.title(),
        portal: adapter.kind,
        adapterSupport: adapter.support,
        inspectedAt: new Date().toISOString(),
        captchaDetected: false,
        fields: [],
        submitControls: [],
        pauses: [
          {
            code: "UNSUPPORTED_PORTAL",
            message: error.message,
            severity: "pause",
          },
        ],
      };
    }
  }

  async requestAutofillPlan(
    applicationId: string,
    profile: CandidateAutofillProfile,
  ): Promise<AutofillPlan> {
    const inspection = await this.inspectForm();
    return buildAutofillPlan(applicationId, inspection, profile);
  }

  async fillApprovedFields(
    plan: AutofillPlan,
    authorization: AutofillAuthorization,
  ): Promise<AutofillResult> {
    requireValidAutofillAuthorization(plan, authorization);
    const page = await this.worker.page();

    if (page.url() !== plan.url) {
      throw new BrowserSafetyError(
        "AUTOFILL_NOT_AUTHORIZED",
        "The current page does not match the approved autofill plan.",
      );
    }

    const preflight = await this.inspectForm();
    if (preflight.captchaDetected) {
      const screenshotPath = await this.worker.screenshot(
        `${plan.applicationId}-captcha-pause`,
      );
      await this.emit({
        action: "autofill_paused",
        applicationId: plan.applicationId,
        message: "Autofill paused because a CAPTCHA is visible.",
      });
      return {
        applicationId: plan.applicationId,
        planId: plan.id,
        state: "AUTOFILL_PAUSED",
        filledFieldIds: [],
        skippedFieldIds: plan.mappings.map((mapping) => mapping.field.id),
        pauses: preflight.pauses,
        screenshotPath,
      };
    }

    await this.emit({
      action: "autofill_started",
      applicationId: plan.applicationId,
      message: "User-approved autofill started.",
    });

    const approvedIds = new Set(authorization.approvedFieldIds);
    const filledFieldIds: string[] = [];
    const skippedFieldIds: string[] = [];
    const executionPauses: PauseSignal[] = [];

    for (const mapping of plan.mappings) {
      if (!approvedIds.has(mapping.field.id)) {
        skippedFieldIds.push(mapping.field.id);
        continue;
      }

      const locator = page.locator(mapping.field.selector);
      if ((await locator.count()) !== 1 || !(await locator.isVisible())) {
        skippedFieldIds.push(mapping.field.id);
        executionPauses.push({
          code: "UNKNOWN_REQUIRED_QUESTION",
          message: `Field changed or disappeared before autofill: ${mapping.field.label}`,
          fieldId: mapping.field.id,
          severity: "pause",
        });
        continue;
      }

      try {
        await fillMapping(locator, mapping);
        filledFieldIds.push(mapping.field.id);
        await this.emit({
          action: "field_filled",
          applicationId: plan.applicationId,
          fieldId: mapping.field.id,
          message: `Filled ${mapping.field.label} from ${mapping.sourceLabel}.`,
        });
      } catch (error) {
        skippedFieldIds.push(mapping.field.id);
        executionPauses.push({
          code: "USER_REVIEW_REQUIRED",
          message:
            error instanceof Error
              ? error.message
              : `Manual input is required for ${mapping.field.label}.`,
          fieldId: mapping.field.id,
          severity: "pause",
        });
      }
    }

    const postfillInspection = await this.inspectForm();
    const unfilledRequired = postfillInspection.fields.filter((field) => {
      if (!field.required || field.disabled || field.hasValue) return false;
      if (field.kind !== "radio") return true;
      return !postfillInspection.fields.some(
        (candidate) =>
          candidate.kind === "radio" &&
          candidate.name === field.name &&
          candidate.hasValue,
      );
    });
    executionPauses.push(
      ...unfilledRequired.map((field) => ({
        code: "UNKNOWN_REQUIRED_QUESTION" as const,
        message: `Required field still needs manual completion: ${field.label}`,
        fieldId: field.id,
        severity: "pause" as const,
      })),
    );

    const currentFields = new Map(
      postfillInspection.fields.map((field) => [field.id, field]),
    );
    const blockingPlanPauses = plan.pauses.filter(
      (pause) => {
        if (pause.severity !== "pause") return false;
        if (pause.code === "CAPTCHA_DETECTED" && !postfillInspection.captchaDetected) {
          return false;
        }
        return !pause.fieldId || !currentFields.get(pause.fieldId)?.hasValue;
      },
    );
    const pauses = [...blockingPlanPauses, ...executionPauses].filter(
      (pause, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.code === pause.code && candidate.fieldId === pause.fieldId,
        ) === index,
    );
    const state = pauses.length > 0 ? "AUTOFILL_PAUSED" : "READY_TO_SUBMIT";
    const screenshotPath = await this.worker.screenshot(
      `${plan.applicationId}-${state.toLowerCase()}`,
    );

    await this.emit({
      action: state === "READY_TO_SUBMIT" ? "ready_to_submit" : "autofill_paused",
      applicationId: plan.applicationId,
      message:
        state === "READY_TO_SUBMIT"
          ? "Approved fields were filled. The final submit control was not pressed."
          : "Approved fields were filled where safe; manual review is still required.",
    });

    return {
      applicationId: plan.applicationId,
      planId: plan.id,
      state,
      filledFieldIds,
      skippedFieldIds,
      pauses,
      screenshotPath,
    };
  }

  async reportPageState(): Promise<BrowserPageState> {
    const inspection = await this.inspectForm();
    return {
      url: inspection.url,
      title: inspection.title,
      portal: inspection.portal,
      adapterSupport: inspection.adapterSupport,
      captchaDetected: inspection.captchaDetected,
      visibleFieldCount: inspection.fields.length,
      submitControlCount: inspection.submitControls.length,
      reportedAt: new Date().toISOString(),
    };
  }

  async submitApprovedApplication(
    plan: AutofillPlan,
    approvalProvider?: SubmissionApprovalProvider,
  ): Promise<SubmissionResult> {
    const { page, adapter } = await this.pageAndAdapter();
    if (page.url() !== plan.url) {
      throw new BrowserSafetyError(
        "SUBMISSION_APPROVAL_MISMATCH",
        "The current page does not match the application approved for submission.",
      );
    }

    const inspection = await this.inspectForm();
    if (inspection.captchaDetected) {
      throw new BrowserSafetyError(
        "CAPTCHA_DETECTED",
        "Final submission is paused while a CAPTCHA is visible.",
      );
    }
    const incompleteRequiredFields = inspection.fields.filter((field) => {
      if (!field.required || field.disabled || field.hasValue) return false;
      if (field.kind !== "radio") return true;
      return !inspection.fields.some(
        (candidate) =>
          candidate.kind === "radio" &&
          candidate.name === field.name &&
          candidate.hasValue,
      );
    });
    if (incompleteRequiredFields.length > 0) {
      throw new BrowserSafetyError(
        "FIELD_REVIEW_REQUIRED",
        `Complete all required fields before approval: ${incompleteRequiredFields
          .map((field) => field.label)
          .join(", ")}`,
      );
    }
    if (inspection.submitControls.length !== 1) {
      throw new BrowserSafetyError(
        "FINAL_SUBMIT_CONTROL_NOT_UNIQUE",
        "Final submission requires exactly one visible, enabled Submit, Apply, or Confirm control.",
      );
    }
    const submitControl = inspection.submitControls[0];
    if (submitControl.disabled) {
      throw new BrowserSafetyError(
        "FINAL_SUBMIT_CONTROL_NOT_UNIQUE",
        "The final submit control is disabled.",
      );
    }

    const request = {
      scope: "single_application_submit" as const,
      applicationId: plan.applicationId,
      planId: plan.id,
      url: page.url(),
      requestedAt: new Date().toISOString(),
    };
    const approval = await requireVerifiedSubmissionApproval(
      request,
      approvalProvider,
    );
    await this.emit({
      action: "submission_verified",
      applicationId: plan.applicationId,
      message: `Verified submission approval ${approval.verificationId}.`,
    });

    // Re-check after the asynchronous verifier returns. A changed page or challenge
    // invalidates the approval rather than carrying it to a different side effect.
    const finalInspection = await this.inspectForm();
    const finalIncompleteRequiredFields = finalInspection.fields.filter((field) => {
      if (!field.required || field.disabled || field.hasValue) return false;
      if (field.kind !== "radio") return true;
      return !finalInspection.fields.some(
        (candidate) =>
          candidate.kind === "radio" &&
          candidate.name === field.name &&
          candidate.hasValue,
      );
    });
    if (
      page.url() !== approval.url ||
      finalInspection.captchaDetected ||
      finalIncompleteRequiredFields.length > 0 ||
      finalInspection.submitControls.length !== 1 ||
      finalInspection.submitControls[0].disabled
    ) {
      throw new BrowserSafetyError(
        "SUBMISSION_APPROVAL_MISMATCH",
        "The page changed after approval verification; request a fresh approval.",
      );
    }

    const beforeUrl = page.url();
    const beforeConfirmation = adapter.confirmSubmission
      ? await adapter.confirmSubmission(page, { beforeUrl }).catch(() => null)
      : null;
    await this.worker.screenshot(`${plan.applicationId}-before-submit`);
    await page.locator(finalInspection.submitControls[0].selector).click();
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    const confirmation = adapter.confirmSubmission
      ? await adapter.confirmSubmission(page, { beforeUrl }).catch(() => ({
          confirmed: false,
          finalUrl: page.url(),
          evidence: [],
          matchedSignals: [] as SubmissionConfirmation["matchedSignals"],
          noValidationErrors: false,
        }))
      : {
          confirmed: false,
          finalUrl: page.url(),
          evidence: [],
          matchedSignals: [] as SubmissionConfirmation["matchedSignals"],
          noValidationErrors: false,
        };
    const priorEvidence = new Set(beforeConfirmation?.evidence ?? []);
    const causalEvidence = confirmation.evidence.filter((item) => !priorEvidence.has(item));
    const successUrlAppeared = confirmation.matchedSignals.includes("success_url")
      && !beforeConfirmation?.matchedSignals.includes("success_url");
    const causallyConfirmed = confirmation.confirmed
      && (causalEvidence.length > 0 || successUrlAppeared);
    const screenshotPath = await this.worker.screenshot(
      `${plan.applicationId}-${causallyConfirmed ? "submitted" : "submission-unconfirmed"}`,
    );
    const attemptedAt = new Date().toISOString();
    if (!causallyConfirmed) {
      await this.emit({
        action: "submission_unconfirmed",
        applicationId: plan.applicationId,
        message: "The approved submit control was pressed, but no portal success evidence was found. Verify the result manually.",
      });
      return {
        applicationId: plan.applicationId,
        planId: plan.id,
        portal: plan.portal,
        state: "SUBMISSION_UNCONFIRMED",
        verificationId: approval.verificationId,
        attemptedAt,
        confirmationEvidence: [],
        confirmation,
        screenshotPath,
      };
    }

    const submittedAt = attemptedAt;
    await this.emit({
      action: "submitted",
      applicationId: plan.applicationId,
      message: "The explicitly approved application was submitted and the portal showed success evidence.",
    });

    return {
      applicationId: plan.applicationId,
      planId: plan.id,
      portal: plan.portal,
      state: "SUBMITTED",
      verificationId: approval.verificationId,
      attemptedAt,
      submittedAt,
      confirmationEvidence: causalEvidence,
      confirmation,
      screenshotPath,
    };
  }
}
