import { confirmDomSubmission, extractDomJob, inspectDomForm } from "./dom";
import type { PortalAdapter } from "./types";

export const genericPortalAdapter: PortalAdapter = {
  kind: "generic",
  label: "Generic employer portal",
  support: "supported",
  async matches() {
    return true;
  },
  async inspectForm(page) {
    return inspectDomForm(page, "generic", "supported");
  },
  async extractVisibleJob(page) {
    return extractDomJob(page, "generic", {
      title: [
        "[data-job-title]",
        "[itemprop='title']",
        "main h1",
        "article h1",
        "h1",
      ],
      company: [
        "[data-company-name]",
        "[itemprop='hiringOrganization'] [itemprop='name']",
        "[itemprop='hiringOrganization']",
        ".company-name",
      ],
      location: [
        "[data-job-location]",
        "[itemprop='jobLocation']",
        ".job-location",
        ".location",
      ],
      description: [
        "[data-job-description]",
        "[itemprop='description']",
        ".job-description",
        "article",
        "main",
      ],
    });
  },
  async confirmSubmission(page, context) {
    return confirmDomSubmission(page, {
      ...context,
      successSelectors: [
        "[role='status']",
        "[role='alert']",
        ".application-confirmation",
        ".confirmation",
        ".success",
        "[data-application-status='submitted']",
      ],
    });
  },
};
