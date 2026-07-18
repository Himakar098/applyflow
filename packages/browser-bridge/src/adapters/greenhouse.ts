import { confirmDomSubmission, extractDomJob, inspectDomForm } from "./dom";
import type { PortalAdapter } from "./types";

export const greenhousePortalAdapter: PortalAdapter = {
  kind: "greenhouse",
  label: "Greenhouse",
  support: "supported",
  async matches(page) {
    const hostname = new URL(page.url()).hostname.toLowerCase();
    if (
      hostname === "boards.greenhouse.io" ||
      hostname.endsWith(".greenhouse.io") ||
      hostname === "job-boards.greenhouse.io" ||
      hostname.endsWith(".greenhouse.com")
    ) {
      return true;
    }
    return (
      (await page
        .locator(
          "body[data-portal='greenhouse'], #application_form, form[action*='greenhouse']",
        )
        .count()) > 0
    );
  },
  async inspectForm(page) {
    return inspectDomForm(page, "greenhouse", "supported");
  },
  async extractVisibleJob(page) {
    return extractDomJob(page, "greenhouse", {
      title: ["[data-job-title]", ".app-title", ".job__title h1", "main h1", "h1"],
      company: [
        "[data-company-name]",
        ".company-name",
        "[itemprop='hiringOrganization']",
      ],
      location: [
        "[data-job-location]",
        ".location",
        "[itemprop='jobLocation']",
      ],
      description: [
        "[data-job-description]",
        "#content",
        ".job__description",
        "[itemprop='description']",
        "main",
      ],
    });
  },
  async confirmSubmission(page, context) {
    return confirmDomSubmission(page, {
      ...context,
      successSelectors: [
        "#application_confirmation",
        ".application--confirmation",
        "[data-qa='application-confirmation']",
        "[role='status']",
        "[role='alert']",
      ],
    });
  },
};
