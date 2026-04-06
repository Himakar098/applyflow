import { randomUUID } from "crypto";

import type { ExternalJob } from "@/lib/recommendations/types";

type ProviderInput = {
  roles: string[];
  locations: string[];
  workModes: string[];
};

type AdzunaJob = {
  id?: string | number;
  redirect_url?: string;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  created?: string;
};

export type Provider = {
  name: string;
  fetch: (input: ProviderInput) => Promise<ExternalJob[]>;
};

function resolveRecommendationProvider() {
  const explicit = (process.env.RECOMMENDATIONS_PROVIDER ?? "").trim().toLowerCase();

  if (explicit === "adzuna" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    return "adzuna";
  }

  if (!explicit && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    return "adzuna";
  }

  if (explicit !== "mock" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    return "adzuna";
  }

  return "mock";
}

const DEFAULT_TIMEOUT_MS = 7000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAdzuna(job: AdzunaJob): ExternalJob {
  return {
    id: String(job?.id ?? job?.redirect_url ?? randomUUID()),
    title: job?.title ?? "",
    company: job?.company?.display_name ?? "",
    location: job?.location?.display_name ?? "",
    description: job?.description ?? "",
    url: job?.redirect_url ?? "",
    source: "Adzuna",
    postedAt: job?.created ?? "",
  };
}

const ADZUNA_COUNTRY_HINTS: Array<{ code: string; keywords: string[] }> = [
  {
    code: "au",
    keywords: [
      "australia",
      "au",
      "perth",
      "sydney",
      "melbourne",
      "brisbane",
      "adelaide",
      "canberra",
      "hobart",
      "darwin",
    ],
  },
  {
    code: "gb",
    keywords: ["united kingdom", "uk", "london", "manchester", "edinburgh", "glasgow"],
  },
  {
    code: "ca",
    keywords: ["canada", "toronto", "vancouver", "montreal", "ottawa", "calgary"],
  },
  {
    code: "us",
    keywords: ["united states", "usa", "us", "new york", "san francisco", "chicago", "austin"],
  },
];

function resolveAdzunaCountry(location: string) {
  const normalized = location.toLowerCase();
  const byKeyword = ADZUNA_COUNTRY_HINTS.find((hint) =>
    hint.keywords.some((keyword) => normalized.includes(keyword)),
  );
  return byKeyword?.code ?? "us";
}

async function adzunaProvider(input: ProviderInput): Promise<ExternalJob[]> {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) return [];
  const roleQueries = input.roles.length
    ? input.roles.filter(Boolean).slice(0, 3)
    : ["Business Analyst"];
  const hasRemote = input.workModes.some((mode) => mode.toLowerCase().includes("remote"));
  const preferredLocation = input.locations.find((loc) => loc && loc.trim().length > 0);
  const fallbackLocation = hasRemote ? "Remote" : "United States";
  const location = preferredLocation ?? fallbackLocation;
  const country = resolveAdzunaCountry(location || "United States");
  const responses = await Promise.all(
    roleQueries.map(async (roleQuery) => {
      const params = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID!,
        app_key: process.env.ADZUNA_APP_KEY!,
        what: roleQuery,
        where: location || fallbackLocation,
        results_per_page: "20",
        max_days_old: "30",
      });

      const res = await fetchWithTimeout(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`,
        { method: "GET" },
      );
      if (!res.ok) return [] as ExternalJob[];
      const data = await res.json();
      return (data.results || []).map(normalizeAdzuna);
    }),
  );

  const unique = new Map<string, ExternalJob>();
  for (const jobs of responses) {
    for (const job of jobs) {
      const key = job.url || job.id;
      if (!unique.has(key)) {
        unique.set(key, job);
      }
    }
  }

  return Array.from(unique.values()).slice(0, 20);
}

function mockProvider(input: ProviderInput): ExternalJob[] {
  const roles = input.roles.length ? input.roles : ["Product Manager", "Data Analyst"];
  const locations = input.locations.length ? input.locations : ["Remote"];
  const samples = [
    {
      title: `${roles[0]} - Growth`,
      company: "Nimbus Labs",
      description:
        "Own roadmap experiments, collaborate with data and engineering, build dashboards, SQL and Python preferred.",
    },
    {
      title: `${roles[0]} - Platform`,
      company: "Argo Systems",
      description:
        "Lead cross-functional delivery, partner with stakeholders, define metrics, and ship scalable solutions.",
    },
    {
      title: roles[1] ?? "Data Analyst",
      company: "Juniper Health",
      description:
        "Analyze product funnels, build Looker dashboards, automate reporting, and support KPI reviews.",
    },
    {
      title: roles[0],
      company: "VantaWorks",
      description:
        "Work with remote teams, define requirements, run retros, and improve GTM operations.",
    },
    {
      title: "Business Analyst",
      company: "Atlas Cloud",
      description:
        "Gather requirements, map processes, and collaborate with AWS data pipelines.",
    },
  ];

  return samples.map((sample, idx) => ({
    id: `mock-${idx}-${sample.company.toLowerCase().replace(/\s/g, "-")}`,
    title: sample.title,
    company: sample.company,
    location: locations[idx % locations.length],
    description: sample.description,
    url: "https://example.com/jobs/mock",
    source: "external",
  }));
}

export function getRecommendationProvider(): Provider {
  const provider = resolveRecommendationProvider();
  if (provider === "adzuna") {
    return {
      name: "Adzuna",
      fetch: adzunaProvider,
    };
  }
  return {
    name: "Mock",
    fetch: async (input) => mockProvider(input),
  };
}
