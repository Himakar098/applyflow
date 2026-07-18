import { extractDomJob } from "./dom";
import type { PortalKind } from "../types";
import { UnsupportedPortalError, type PortalAdapter } from "./types";

interface StubConfig {
  kind: Exclude<PortalKind, "generic" | "greenhouse" | "lever">;
  label: string;
  hosts: string[];
  markers: string[];
}

function createStubAdapter(config: StubConfig): PortalAdapter {
  return {
    kind: config.kind,
    label: config.label,
    support: "stub",
    async matches(page) {
      const hostname = new URL(page.url()).hostname.toLowerCase();
      if (
        config.hosts.some(
          (host) => hostname === host || hostname.endsWith(`.${host}`),
        )
      ) {
        return true;
      }
      return (
        (await page
          .locator(
            [`body[data-portal='${config.kind}']`, ...config.markers].join(","),
          )
          .count()) > 0
      );
    },
    async inspectForm() {
      throw new UnsupportedPortalError(config.kind);
    },
    async extractVisibleJob(page) {
      return extractDomJob(page, config.kind, {
        title: ["[data-job-title]", "main h1", "h1"],
        company: ["[data-company-name]", ".company-name"],
        location: ["[data-job-location]", ".location"],
        description: ["[data-job-description]", ".job-description", "main"],
      });
    },
  };
}

export const workdayPortalAdapter = createStubAdapter({
  kind: "workday",
  label: "Workday",
  hosts: ["myworkdayjobs.com", "workday.com"],
  markers: ["[data-automation-id='jobPostingDescription']"],
});

export const smartRecruitersPortalAdapter = createStubAdapter({
  kind: "smartrecruiters",
  label: "SmartRecruiters",
  hosts: ["smartrecruiters.com"],
  markers: ["[class*='smartrecruiters' i]"],
});

export const successFactorsPortalAdapter = createStubAdapter({
  kind: "successfactors",
  label: "SAP SuccessFactors",
  hosts: ["successfactors.com", "successfactors.eu"],
  markers: ["[class*='successfactors' i]"],
});

export const pageUpPortalAdapter = createStubAdapter({
  kind: "pageup",
  label: "PageUp",
  hosts: ["pageuppeople.com", "pageuppeople.com.au"],
  markers: ["[class*='pageup' i]"],
});

export const ashbyPortalAdapter = createStubAdapter({
  kind: "ashby",
  label: "Ashby",
  hosts: ["ashbyhq.com"],
  markers: ["[class*='ashby' i]"],
});

export const stubPortalAdapters: PortalAdapter[] = [
  workdayPortalAdapter,
  smartRecruitersPortalAdapter,
  successFactorsPortalAdapter,
  pageUpPortalAdapter,
  ashbyPortalAdapter,
];
