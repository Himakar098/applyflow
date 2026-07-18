import type { BrowserPage } from "../runtime-types";
import {
  classifySensitiveField,
  isNeverAutofillCategory,
  requiresPerFieldReview,
} from "../safety";
import type {
  AdapterSupport,
  FieldKind,
  FieldOption,
  FormInspection,
  InspectedField,
  PauseSignal,
  PortalKind,
  SubmissionConfirmation,
  SubmitControl,
  VisibleJobExtraction,
} from "../types";

interface RawField {
  id: string;
  selector: string;
  label: string;
  name: string;
  kind: string;
  required: boolean;
  disabled: boolean;
  visible: boolean;
  hasValue: boolean;
  placeholder?: string;
  ariaLabel?: string;
  autocomplete?: string;
  options?: FieldOption[];
}

interface RawInspection {
  fields: RawField[];
  submitControls: SubmitControl[];
  captchaDetected: boolean;
}

const supportedKinds = new Set<FieldKind>([
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
]);

function fieldPause(field: InspectedField): PauseSignal | undefined {
  switch (field.sensitiveCategory) {
    case "legal_attestation":
      return {
        code: "LEGAL_ATTESTATION",
        message: `Legal declaration requires manual completion: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    case "identity":
      return {
        code: "IDENTITY_DECLARATION",
        message: `Identity field requires manual completion: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    case "demographic":
    case "diversity":
      return {
        code: "SENSITIVE_DEMOGRAPHIC_FIELD",
        message: `Sensitive demographic field requires manual completion: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    default:
      return undefined;
  }
}

export async function inspectDomForm(
  page: BrowserPage,
  portal: PortalKind,
  support: AdapterSupport,
): Promise<FormInspection> {
  // esbuild/tsx annotates nested functions with `__name` before Playwright
  // serialises the callback. Provide the inert helper in the isolated page
  // realm so source-transformed callbacks remain executable.
  await page.evaluate(
    "globalThis.__name = globalThis.__name || ((target) => target)",
  );
  const raw = (await page.evaluate(() => {
    const visible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();

    const labelledByText = (element: HTMLElement) => {
      const ids = clean(element.getAttribute("aria-labelledby"))
        .split(" ")
        .filter(Boolean);
      return ids
        .map((id) => clean(document.getElementById(id)?.textContent))
        .filter(Boolean)
        .join(" ");
    };

    const fieldLabel = (
      element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    ) => {
      const explicitLabels = Array.from(element.labels ?? [])
        .map((label) => clean(label.textContent))
        .filter(Boolean)
        .join(" ");
      const nearestLabel = clean(element.closest("label")?.textContent);
      const fieldsetLegend = clean(
        element.closest("fieldset")?.querySelector("legend")?.textContent,
      );
      const directLabel =
        explicitLabels ||
        clean(element.getAttribute("aria-label")) ||
        labelledByText(element) ||
        nearestLabel;
      const inputType = clean(element.getAttribute("type")).toLowerCase();
      if (
        fieldsetLegend &&
        directLabel &&
        (inputType === "radio" || inputType === "checkbox")
      ) {
        return `${fieldsetLegend}: ${directLabel}`;
      }
      return (
        directLabel ||
        fieldsetLegend ||
        clean(element.getAttribute("placeholder")) ||
        clean(element.getAttribute("name")) ||
        clean(element.id) ||
        "Unlabelled field"
      );
    };

    const kindFor = (
      element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    ) => {
      if (element instanceof HTMLTextAreaElement) return "textarea";
      if (element instanceof HTMLSelectElement) return "select";
      const type = clean(element.getAttribute("type") || "text").toLowerCase();
      return [
        "text",
        "email",
        "tel",
        "url",
        "number",
        "date",
        "checkbox",
        "radio",
        "file",
        "password",
      ].includes(type)
        ? type
        : "unknown";
    };

    const sessionPrefix = `ja-${Date.now().toString(36)}`;
    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input:not([type='hidden']), textarea, select",
      ),
    );

    const fields = elements.map((element, index) => {
      const id =
        element.getAttribute("data-job-agent-field-id") ||
        `${sessionPrefix}-field-${index + 1}`;
      element.setAttribute("data-job-agent-field-id", id);
      const options =
        element instanceof HTMLSelectElement
          ? Array.from(element.options).map((option) => ({
              label: clean(option.textContent),
              value: option.value,
            }))
          : undefined;
      return {
        id,
        selector: `[data-job-agent-field-id="${id}"]`,
        label: fieldLabel(element),
        name: clean(element.getAttribute("name")),
        kind: kindFor(element),
        required:
          element.required || element.getAttribute("aria-required") === "true",
        disabled: element.disabled || element.getAttribute("aria-disabled") === "true",
        visible: visible(element),
        hasValue:
          element instanceof HTMLInputElement &&
          (element.type === "checkbox" || element.type === "radio")
            ? element.checked
            : element instanceof HTMLInputElement && element.type === "file"
              ? (element.files?.length ?? 0) > 0
              : element.value.trim().length > 0,
        placeholder: clean(element.getAttribute("placeholder")) || undefined,
        ariaLabel: clean(element.getAttribute("aria-label")) || undefined,
        autocomplete: clean(element.getAttribute("autocomplete")) || undefined,
        options,
      };
    });

    const isFinalSubmitLabel = (value: string) =>
      /^(submit|submit application|apply|apply now|confirm application|confirm and submit|send application)$/i.test(
        clean(value),
      );

    const candidateButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, input[type='submit'], input[type='button'], [role='button']",
      ),
    );

    const submitControls = candidateButtons
      .map((element, index) => {
        const input = element as HTMLInputElement;
        const label = clean(
          input.value || element.textContent || element.getAttribute("aria-label"),
        );
        if (!isFinalSubmitLabel(label)) return undefined;
        const id =
          element.getAttribute("data-job-agent-submit-control") ||
          `${sessionPrefix}-submit-${index + 1}`;
        element.setAttribute("data-job-agent-submit-control", id);
        return {
          id,
          selector: `[data-job-agent-submit-control="${id}"]`,
          label,
          visible: visible(element),
          disabled:
            input.disabled || element.getAttribute("aria-disabled") === "true",
        };
      })
      .filter((control): control is NonNullable<typeof control> => Boolean(control));

    const captchaSelector = [
      "iframe[src*='recaptcha' i]",
      "iframe[src*='hcaptcha' i]",
      "[class*='captcha' i]",
      "[id*='captcha' i]",
      "[data-sitekey]",
      "input[name*='captcha' i]",
    ].join(",");
    const captchaElement = document.querySelector(captchaSelector);
    const bodyText = clean(document.body?.innerText).toLowerCase();
    const captchaDetected =
      Boolean(captchaElement && visible(captchaElement)) ||
      bodyText.includes("i am not a robot") ||
      bodyText.includes("complete the captcha");

    return { fields, submitControls, captchaDetected };
  })) as RawInspection;

  const fields: InspectedField[] = raw.fields
    .filter((field) => field.visible)
    .map((field) => {
      const kind = supportedKinds.has(field.kind as FieldKind)
        ? (field.kind as FieldKind)
        : "unknown";
      const sensitiveCategory = classifySensitiveField({ ...field, kind });
      return {
        ...field,
        kind,
        sensitiveCategory,
        reviewRequired:
          isNeverAutofillCategory(sensitiveCategory) ||
          requiresPerFieldReview(sensitiveCategory),
      };
    });

  const pauses = fields
    .map(fieldPause)
    .filter((pause): pause is PauseSignal => Boolean(pause));

  if (raw.captchaDetected) {
    pauses.unshift({
      code: "CAPTCHA_DETECTED",
      message:
        "A CAPTCHA or anti-bot challenge is visible. Automation is paused for manual completion.",
      severity: "pause",
    });
  }

  return {
    url: page.url(),
    title: await page.title(),
    portal,
    adapterSupport: support,
    inspectedAt: new Date().toISOString(),
    captchaDetected: raw.captchaDetected,
    fields,
    submitControls: raw.submitControls.filter((control) => control.visible),
    pauses,
  };
}

export async function extractDomJob(
  page: BrowserPage,
  portal: PortalKind,
  selectors: {
    title: string[];
    company: string[];
    location: string[];
    description: string[];
  },
): Promise<VisibleJobExtraction> {
  await page.evaluate(
    "globalThis.__name = globalThis.__name || ((target) => target)",
  );
  const extracted = await page.evaluate((requestedSelectors) => {
    const firstText = (candidates: string[]) => {
      for (const selector of candidates) {
        const value = document.querySelector(selector)?.textContent
          ?.replace(/\s+/g, " ")
          .trim();
        if (value) return value;
      }
      return undefined;
    };

    return {
      title: firstText(requestedSelectors.title),
      company: firstText(requestedSelectors.company),
      location: firstText(requestedSelectors.location),
      descriptionText: firstText(requestedSelectors.description)?.slice(0, 100_000),
    };
  }, selectors);

  return {
    portal,
    sourceUrl: page.url(),
    ...extracted,
    extractedAt: new Date().toISOString(),
  };
}

export async function confirmDomSubmission(
  page: BrowserPage,
  options: { beforeUrl: string; successSelectors: string[] },
): Promise<SubmissionConfirmation> {
  await page.evaluate(
    "globalThis.__name = globalThis.__name || ((target) => target)",
  );
  const result = await page.evaluate((input) => {
    const clean = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const visible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const strongSuccessText = (value: string) =>
      /\b(application (?:has been |was )?(?:submitted|received)|successfully (?:submitted|applied)|thank you for (?:applying|your application)|submission (?:confirmed|successful)|mock application submitted)\b/i.test(value);

    const evidence: string[] = [];
    for (const selector of input.successSelectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const text = clean(element.textContent);
        if (visible(element) && strongSuccessText(text)) {
          evidence.push(`${selector}: ${text.slice(0, 240)}`);
        }
      }
    }

    const finalUrl = window.location.href;
    let successUrl = false;
    if (
      finalUrl !== input.beforeUrl &&
      /\/(?:thank-?you|confirmation|submitted|success)(?:[/?#]|$)/i.test(finalUrl)
    ) {
      successUrl = true;
      const heading = clean(document.querySelector("main h1, main h2, h1, h2")?.textContent);
      if (strongSuccessText(heading)) evidence.push(`confirmation page: ${heading.slice(0, 240)}`);
    }

    const finalSubmitLabel = (value: string) =>
      /^(submit|submit application|apply|apply now|confirm application|confirm and submit|send application)$/i.test(clean(value));
    const submitControlPresent = Array.from(document.querySelectorAll<HTMLElement>(
      "button, input[type='submit'], input[type='button'], [role='button']",
    )).some((element) => {
      const input = element as HTMLInputElement;
      return visible(element) && !input.disabled && finalSubmitLabel(
        input.value || element.textContent || element.getAttribute("aria-label") || "",
      );
    });
    const invalidControlPresent = Array.from(document.querySelectorAll<HTMLElement>(
      "input:invalid, textarea:invalid, select:invalid, [aria-invalid='true']",
    )).some(visible);
    const visibleValidationError = Array.from(document.querySelectorAll<HTMLElement>(
      "[role='alert'], .error, .errors, .validation-error, [data-error]",
    )).some((element) => visible(element) && /\b(error|invalid|required|could not|failed)\b/i.test(clean(element.textContent)));
    const noValidationErrors = !invalidControlPresent && !visibleValidationError;
    const receiptElement = Array.from(document.querySelectorAll<HTMLElement>(
      "[data-confirmation-id], [data-application-id], .confirmation-number, .receipt-id",
    )).find(visible);
    const portalReceiptId = receiptElement
      ? clean(receiptElement.getAttribute("data-confirmation-id") || receiptElement.getAttribute("data-application-id") || receiptElement.textContent).slice(0, 300)
      : undefined;

    return {
      finalUrl,
      evidence,
      successUrl,
      submitControlAbsent: !submitControlPresent,
      noValidationErrors,
      portalReceiptId,
    };
  }, options);

  const matchedSignals: SubmissionConfirmation["matchedSignals"] = [];
  if (result.successUrl) matchedSignals.push("success_url");
  if (result.evidence.length) matchedSignals.push("confirmation_heading");
  if (result.portalReceiptId) matchedSignals.push("receipt_identifier");
  if (result.submitControlAbsent) matchedSignals.push("submit_control_absent");
  if (result.noValidationErrors) matchedSignals.push("no_validation_errors");

  return {
    confirmed:
      result.evidence.length > 0 &&
      result.submitControlAbsent &&
      result.noValidationErrors,
    finalUrl: result.finalUrl,
    evidence: result.evidence,
    matchedSignals,
    noValidationErrors: result.noValidationErrors,
    portalReceiptId: result.portalReceiptId,
  };
}
