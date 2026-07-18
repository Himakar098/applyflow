import { confirmDomSubmission, extractDomJob, inspectDomForm } from "./dom";
import type { PortalAdapter } from "./types";

export const leverPortalAdapter: PortalAdapter = {
  kind: "lever",
  label: "Lever",
  support: "supported",
  async matches(page) {
    const hostname = new URL(page.url()).hostname.toLowerCase();
    if (hostname === "jobs.lever.co" || hostname.endsWith(".lever.co")) {
      return true;
    }
    return (
      (await page
        .locator(
          "body[data-portal='lever'], .lever-job-application, form[action*='lever']",
        )
        .count()) > 0
    );
  },
  async inspectForm(page) {
    return inspectDomForm(page, "lever", "supported");
  },
  async extractVisibleJob(page) {
    return extractDomJob(page, "lever", {
      title: [
        "[data-job-title]",
        ".posting-headline h2",
        ".posting-header h2",
        "main h1",
        "h1",
      ],
      company: ["[data-company-name]", ".main-header-logo", ".company-name"],
      location: [
        "[data-job-location]",
        ".posting-categories .location",
        ".posting-category.location",
        ".location",
      ],
      description: [
        "[data-job-description]",
        ".posting-page .content",
        ".posting-description",
        ".section-wrapper",
        "main",
      ],
    });
  },
  async confirmSubmission(page, context) {
    return confirmDomSubmission(page, {
      ...context,
      successSelectors: [
        ".application-confirmation",
        ".application-success",
        "[data-qa='application-confirmation']",
        "[role='status']",
        "[role='alert']",
      ],
    });
  },
};
