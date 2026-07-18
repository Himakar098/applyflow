import "server-only";

import * as cheerio from "cheerio";

import { HttpError } from "@/lib/http-error";
import {
  assertPublicHttpUrl,
  requestPublicHttpUrl,
} from "@/lib/security/job-agent-request";

export type ImportedJobSource = {
  adapter: "greenhouse" | "lever" | "generic";
  sourceUrl: string;
  applicationUrl: string;
  title?: string;
  company?: string;
  location?: string;
  datePosted?: string;
  closingDate?: string;
  employmentType?: string;
  description: string;
};

export interface JobSourceAdapter {
  id: ImportedJobSource["adapter"] | "workday" | "smartrecruiters" | "successfactors" | "pageup" | "ashby";
  canHandle(url: URL): boolean;
  import(url: URL): Promise<ImportedJobSource>;
}

type JsonLdJob = {
  "@type"?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string };
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
    | Array<{ address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }>;
};

function cleanText(value: string | undefined, max = 100_000) {
  return (value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function htmlToText(value: string | undefined) {
  if (!value) return "";
  return cleanText(cheerio.load(`<main>${value}</main>`)("main").text());
}

function collectJsonLd($: cheerio.CheerioAPI) {
  const jobs: JsonLdJob[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text();
    try {
      const parsed = JSON.parse(raw) as JsonLdJob | JsonLdJob[] | { "@graph"?: JsonLdJob[] };
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { "@graph"?: JsonLdJob[] })["@graph"])
          ? (parsed as { "@graph": JsonLdJob[] })["@graph"]
          : [parsed as JsonLdJob];
      jobs.push(...candidates.filter((entry) => entry?.["@type"] === "JobPosting"));
    } catch {
      // Ignore invalid third-party JSON-LD; the visible page remains the fallback.
    }
  });
  return jobs;
}

function jsonLdLocation(job?: JsonLdJob) {
  const locations = Array.isArray(job?.jobLocation) ? job.jobLocation : job?.jobLocation ? [job.jobLocation] : [];
  return locations
    .map((item) => item.address)
    .filter(Boolean)
    .map((address) => [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(", "))
    .filter(Boolean)
    .join("; ");
}

async function fetchPublicHtml(initialUrl: URL) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await requestPublicHttpUrl(current, {
      maxBytes: 2_000_000,
      timeoutMs: 12_000,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ApplyFlow-Job-Agent/1.0 (user-directed public job import)",
      },
    }).catch(() => null);
    if (!response) throw new HttpError(502, "The job page could not be reached");

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "The job page returned an invalid redirect");
      current = new URL(location, current);
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new HttpError(502, `The job page returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new HttpError(415, "The job URL did not return an HTML page");
    }
    const html = response.body.toString("utf8");
    return { html, finalUrl: current };
  }
  throw new HttpError(502, "The job page redirected too many times");
}

function fromPage(
  adapter: ImportedJobSource["adapter"],
  finalUrl: URL,
  html: string,
  selectors: { description: string[]; title: string[]; company: string[]; location: string[] },
): ImportedJobSource {
  const $ = cheerio.load(html);
  const job = collectJsonLd($)[0];
  const firstText = (values: string[]) => {
    for (const selector of values) {
      const value = cleanText($(selector).first().text(), 500);
      if (value) return value;
    }
    return undefined;
  };
  const descriptionFromPage = selectors.description
    .map((selector) => cleanText($(selector).first().text()))
    .find(Boolean);
  const description = htmlToText(job?.description) || descriptionFromPage || cleanText($("main").text()) || cleanText($("body").text());
  if (description.length < 80) {
    throw new HttpError(422, "The public page did not contain enough visible job-description text");
  }

  return {
    adapter,
    sourceUrl: finalUrl.toString(),
    applicationUrl: finalUrl.toString(),
    title: cleanText(job?.title, 200) || firstText(selectors.title),
    company: cleanText(job?.hiringOrganization?.name, 200) || firstText(selectors.company),
    location: jsonLdLocation(job) || firstText(selectors.location),
    datePosted: cleanText(job?.datePosted, 80) || undefined,
    closingDate: cleanText(job?.validThrough, 80) || undefined,
    employmentType: Array.isArray(job?.employmentType)
      ? job.employmentType.join(", ")
      : cleanText(job?.employmentType, 120) || undefined,
    description,
  };
}

const greenhouse: JobSourceAdapter = {
  id: "greenhouse",
  canHandle: (url) => ["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(url.hostname.toLowerCase()),
  async import(url) {
    const page = await fetchPublicHtml(url);
    return fromPage("greenhouse", page.finalUrl, page.html, {
      description: ["#content", "#job_description", ".job__description", "main"],
      title: ["h1.app-title", "h1"],
      company: [".company-name", "meta[property='og:site_name']"],
      location: [".location", "[data-qa='job-location']"],
    });
  },
};

const lever: JobSourceAdapter = {
  id: "lever",
  canHandle: (url) => url.hostname.toLowerCase() === "jobs.lever.co",
  async import(url) {
    const page = await fetchPublicHtml(url);
    return fromPage("lever", page.finalUrl, page.html, {
      description: [".section-wrapper.page-full-width", ".posting-page", "main"],
      title: ["h2", "h1"],
      company: [".main-header-logo img[alt]", "meta[property='og:site_name']"],
      location: [".location", ".posting-categories .sort-by-location"],
    });
  },
};

const generic: JobSourceAdapter = {
  id: "generic",
  canHandle: () => true,
  async import(url) {
    const page = await fetchPublicHtml(url);
    return fromPage("generic", page.finalUrl, page.html, {
      description: ["[itemprop='description']", ".job-description", "article", "main"],
      title: ["h1", "meta[property='og:title']"],
      company: ["[itemprop='hiringOrganization']", ".company", "meta[property='og:site_name']"],
      location: ["[itemprop='jobLocation']", ".location"],
    });
  },
};

export const unsupportedPortalAdapters = [
  "workday",
  "smartrecruiters",
  "successfactors",
  "pageup",
  "ashby",
] as const;

export async function importPublicJobUrl(value: string) {
  const url = await assertPublicHttpUrl(value);
  const adapter = [greenhouse, lever, generic].find((candidate) => candidate.canHandle(url)) ?? generic;
  return adapter.import(url);
}
