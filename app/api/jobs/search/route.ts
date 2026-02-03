import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { checkAndIncrementUsage } from "@/lib/services/usage-limits";

export const runtime = "nodejs";

type SearchFilters = {
  query?: string;
  location?: string;
  remote?: string;
  datePosted?: string;
  jobType?: string;
  jobUrl?: string;
  page?: number;
};

function handleError(error: unknown, digest: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, digest },
      { status: error.status },
    );
  }
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

    if (provider === "serpapi" && process.env.SERPAPI_API_KEY) {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q: query,
        location: location || "United States",
        hl: "en",
        api_key: process.env.SERPAPI_API_KEY,
        start: String((page - 1) * 10),
      });
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!res.ok) throw new HttpError(502, "search_provider_error");
      const data = await res.json();
      const results = (data.jobs_results || []).map((job: any) => ({
        title: job.title || "",
        company: job.company_name || "",
        location: job.location || "",
        source: job.via || "SerpAPI",
        snippet: job.description || "",
        sourceUrl: job.job_id ? job.related_links?.[0]?.link : job.link,
        postedAt: job.detected_extensions?.posted_at || "",
      }));
      return NextResponse.json({ ok: true, results, digest }, { status: 200 });
    }

    if (provider === "adzuna" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
      const country = "us";
      const params = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: query,
        where: location || "United States",
        results_per_page: "20",
        page: String(page),
      });
      const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`);
      if (!res.ok) throw new HttpError(502, "search_provider_error");
      const data = await res.json();
      const results = (data.results || []).map((job: any) => ({
        title: job.title || "",
        company: job.company?.display_name || "",
        location: job.location?.display_name || "",
        source: "Adzuna",
        snippet: job.description || "",
        sourceUrl: job.redirect_url || "",
        postedAt: job.created || "",
      }));
      return NextResponse.json({ ok: true, results, digest }, { status: 200 });
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
    return handleError(error, digest);
  }
}
