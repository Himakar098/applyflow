type ResolveInput = {
  title: string;
  company: string;
  location?: string;
  sourceUrl?: string;
};

export type ResolveOutput = {
  applyUrl: string | null;
  candidates: string[];
  confidence: "high" | "medium" | "low";
  reason: string;
};

type SerpResult = {
  link?: string;
};

const AGGREGATOR_HOST_PATTERNS = [
  "linkedin.com",
  "seek.com",
  "seek.com.au",
  "indeed.com",
  "adzuna.",
  "glassdoor.",
  "ziprecruiter.",
  "monster.",
];

const TRACKING_QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid"];

function parseUrl(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value?: string | null) {
  const parsed = parseUrl(value);
  if (!parsed) return null;
  TRACKING_QUERY_KEYS.forEach((key) => parsed.searchParams.delete(key));
  return parsed.toString();
}

function hostFrom(value?: string | null) {
  const parsed = parseUrl(value);
  return parsed?.hostname.toLowerCase() ?? "";
}

function isAggregatorUrl(value?: string | null) {
  const host = hostFrom(value);
  if (!host) return false;
  return AGGREGATOR_HOST_PATTERNS.some((pattern) => host.includes(pattern));
}

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeUrl(value);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}

async function resolveRedirect(url: string) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  // A simple GET with redirect follow tends to work better than HEAD for career providers.
  const response = await fetch(normalized, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "ApplyFlow-Apply-Assistant/1.0 (+https://omnari.world/apply-flow)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  return normalizeUrl(response.url);
}

async function searchCareerLinks(query: string) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [] as string[];

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    num: "10",
    api_key: apiKey,
    hl: "en",
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) return [] as string[];

  const payload = (await response.json()) as { organic_results?: SerpResult[] };
  const links = (payload.organic_results ?? [])
    .map((item) => normalizeUrl(item.link))
    .filter(Boolean) as string[];

  return unique(links);
}

function pickBestCareerLink(links: string[]) {
  if (!links.length) return null;
  const nonAggregators = links.filter((link) => !isAggregatorUrl(link));
  if (nonAggregators.length) return nonAggregators[0];
  return links[0];
}

export async function resolveApplyUrl(input: ResolveInput): Promise<ResolveOutput> {
  const title = input.title.trim();
  const company = input.company.trim();
  const location = input.location?.trim() ?? "";
  const sourceUrl = normalizeUrl(input.sourceUrl);

  const candidates: string[] = [];

  if (sourceUrl) {
    candidates.push(sourceUrl);
    try {
      const redirected = await resolveRedirect(sourceUrl);
      if (redirected) candidates.push(redirected);
      if (redirected && !isAggregatorUrl(redirected)) {
        return {
          applyUrl: redirected,
          candidates: unique(candidates),
          confidence: "high",
          reason: "Resolved direct company/career page from listing redirect.",
        };
      }
    } catch {
      // Ignore redirect failures and continue with search fallback.
    }
  }

  const queryBase = `${company} careers ${title}`.trim();
  const searchQueries = unique([
    location ? `${queryBase} ${location}` : null,
    queryBase,
    `${company} jobs ${title}`,
  ]);

  for (const query of searchQueries) {
    const results = await searchCareerLinks(query);
    if (!results.length) continue;
    candidates.push(...results);
    const picked = pickBestCareerLink(results);
    if (picked && !isAggregatorUrl(picked)) {
      return {
        applyUrl: picked,
        candidates: unique(candidates),
        confidence: "medium",
        reason: "Resolved from web search to a likely company career page.",
      };
    }
  }

  const uniqueCandidates = unique(candidates);
  const fallback = uniqueCandidates[0] ?? null;
  return {
    applyUrl: fallback,
    candidates: uniqueCandidates,
    confidence: fallback && !isAggregatorUrl(fallback) ? "medium" : "low",
    reason: fallback
      ? "Using best available listing URL. Manual verification is recommended."
      : "No reliable application URL found.",
  };
}
