import type { BrowserPage } from "../runtime-types";
import type {
  AdapterSupport,
  FormInspection,
  PortalKind,
  SubmissionConfirmation,
  VisibleJobExtraction,
} from "../types";

export class UnsupportedPortalError extends Error {
  readonly portal: PortalKind;

  constructor(portal: PortalKind) {
    super(
      `${portal} is detected but its live portal adapter is not enabled yet. Continue manually in the visible browser.`,
    );
    this.name = "UnsupportedPortalError";
    this.portal = portal;
  }
}

export interface PortalAdapter {
  readonly kind: PortalKind;
  readonly label: string;
  readonly support: AdapterSupport;
  matches(page: BrowserPage): Promise<boolean>;
  inspectForm(page: BrowserPage): Promise<FormInspection>;
  extractVisibleJob(page: BrowserPage): Promise<VisibleJobExtraction>;
  confirmSubmission?(
    page: BrowserPage,
    context: { beforeUrl: string },
  ): Promise<SubmissionConfirmation>;
}
