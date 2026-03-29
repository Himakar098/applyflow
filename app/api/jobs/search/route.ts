import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { captureServerError } from "@/lib/monitoring/capture-server-error";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

type SearchHistory = {
  query: string;
  location?: string;
  remote?: string;
  jobType?: string;
  datePosted?: string;
  provider: string;
  createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
};

type SearchFilters = {
  query?: string;
  location?: string;
  remote?: string;
  datePosted?: string;
  jobType?: string;
  jobUrl?: string;
  page?: number;
  pageToken?: string;
};

type SerpApiJob = {
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  job_id?: string;
  related_links?: { link?: string }[];
  link?: string;
  detected_extensions?: { posted_at?: string };
};

type AdzunaJob = {
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  redirect_url?: string;
  created?: string;
};

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

function handleError(error: unknown, digest: string, uid?: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }
  captureServerError(error, {
    route: "api/jobs/search",
    digest,
    extra: { uid: uid ?? "unknown" },
  });
  console.error("api/jobs/search", digest, error);
  return NextResponse.json(
    { ok: false, error: "internal_error", digest },
    { status: 500 },
  );
}

function normalizeFallback(url: string) {
  try {
    const parsed = new URL(url);
    const titleGuess = parsed.pathname
      .split("/")
      .filter(Boolean)
      .slice(-1)[0]
      ?.replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Job listing";
    return {
      title: titleGuess || "Job listing",
      company: parsed.hostname.replace("www.", ""),
      location: "",
      source: parsed.hostname.replace("www.", ""),
      snippet: "",
      sourceUrl: url,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const digest = randomUUID();
  let uid = "unknown";

  try {
    uid = (await verifyIdToken(req)).uid;
    const body = (await req.json().catch(() => ({}))) as SearchFilters;

    const usageCheck = await checkAndIncrementUsage({
      uid,
      kind: "job_search",
      increment: 1,
      adminDb,
    });
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { ok: false, error: "DAILY_LIMIT_REACHED", limitType: usageCheck.limitType, digest },
        { status: 429 },
      );
    }

    const provider = process.env.JOB_SEARCH_PROVIDER ?? "none";
    const query = body.query?.toString().trim() ?? "";
    const location = body.location?.toString().trim() ?? "";
    const jobUrl = body.jobUrl?.toString().trim() ?? "";
    const page = Math.max(1, Number(body.page ?? 1));

    if (!query && !jobUrl) {
      throw new HttpError(400, "query or jobUrl is required");
    }

    const trackSearch = async () => {
      if (!query) return;
      const record: SearchHistory = {
        query,
        location: location || undefined,
        remote: body.remote,
        jobType: body.jobType,
        datePosted: body.datePosted,
        provider,
        createdAt: FieldValue.serverTimestamp(),
      };
      try {
        await adminDb.collection("users").doc(uid).collection("searches").add(record);
      } catch (error) {
        console.error("Failed to record search history", error);
      }
    };

    if (provider === "serpapi" && process.env.SERPAPI_API_KEY) {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q: query,
        location: location || "United States",
        hl: "en",
        api_key: process.env.SERPAPI_API_KEY,
      });
      if (body.pageToken) {
        params.set("next_page_token", body.pageToken);
      }
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!res.ok) throw new HttpError(502, "search_provider_error");
      const data = await res.json();
      if (data.error) {
        await trackSearch();
        return NextResponse.json(
          { ok: true, results: [], warning: data.error, digest },
          { status: 200 },
        );
      }
      const results = (data.jobs_results || []).map((job: SerpApiJob) => ({
        title: job.title || "",
        company: job.company_name || "",
        location: job.location || "",
        source: job.via || "SerpAPI",
        snippet: job.description || "",
        sourceUrl: job.job_id ? job.related_links?.[0]?.link : job.link,
        postedAt: job.detected_extensions?.posted_at || "",
      }));
      const nextPageToken = data.serpapi_pagination?.next_page_token || null;
      const warning = results.length === 0 ? "No results for this query/location." : undefined;
      await trackSearch();
      return NextResponse.json(
        { ok: true, results, nextPageToken, warning, digest },
        { status: 200 },
      );
    }

    if (provider === "adzuna" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
      const country = resolveAdzunaCountry(location || "United States");
      const params = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: query,
        where: location || "United States",
        results_per_page: "20",
      });
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`);
      if (!res.ok) throw new HttpError(502, "search_provider_error");
      const data = await res.json();
      const results = (data.results || []).map((job: AdzunaJob) => ({
        title: job.title || "",
        company: job.company?.display_name || "",
        location: job.location?.display_name || "",
        source: "Adzuna",
        snippet: job.description || "",
        sourceUrl: job.redirect_url || "",
        postedAt: job.created || "",
      }));
      const warning = results.length === 0 ? "No results for this query/location." : undefined;
      await trackSearch();
      return NextResponse.json({ ok: true, results, warning, digest }, { status: 200 });
    }

    if (jobUrl) {
      const fallback = normalizeFallback(jobUrl);
      return NextResponse.json(
        { ok: true, results: fallback ? [fallback] : [], digest, warning: "SEARCH_NOT_CONFIGURED" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { ok: true, results: [], digest, warning: "SEARCH_NOT_CONFIGURED" },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, digest, uid);
  }
}
