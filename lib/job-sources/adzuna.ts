import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { RateLimiter, extractSkillsFromDescription, COMMON_SKILLS } from "@/lib/job-sources/index";

type AdzunaApiJob = {
  id?: string | number;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  created?: string;
  redirect_url?: string;
};

type AdzunaApiResponse = {
  results?: AdzunaApiJob[];
  count?: number;
};

/**
 * Adzuna Job Board Integration
 * https://developer.adzuna.com/
 */

export class AdzunaJobSource implements JobSource {
  name = "adzuna";
  displayName = "Adzuna";
  private appId: string;
  private appKey: string;
  private baseUrl = "https://api.adzuna.com/v1";
  private rateLimiter: RateLimiter;

  constructor(appId?: string, appKey?: string) {
    this.appId = appId || process.env.ADZUNA_APP_ID || "";
    this.appKey = appKey || process.env.ADZUNA_APP_KEY || "";
    this.rateLimiter = new RateLimiter(100); // 100 requests/hour
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    if (!this.appId || !this.appKey) {
      throw new Error("Adzuna API credentials not configured");
    }

    await this.rateLimiter.recordRequest();

    const country = (params.country || "us").toLowerCase();
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 50); // Max 50 per request

    const url = new URL(
      `${this.baseUrl}/job_search/${country}/search/${page}`
    );
    url.searchParams.append("app_id", this.appId);
    url.searchParams.append("app_key", this.appKey);
    url.searchParams.append("results_per_page", limit.toString());
    url.searchParams.append("what", params.query);

    if (params.location) {
      url.searchParams.append("where", params.location);
      if (params.distance) {
        url.searchParams.append("distance", params.distance.toString());
      }
    }

    if (params.postedWithin) {
      // Adzuna uses days_old parameter
      url.searchParams.append("days_old", params.postedWithin.toString());
    }

    if (params.salaryMin) {
      url.searchParams.append("salary_min", params.salaryMin.toString());
    }

    if (params.salaryMax) {
      url.searchParams.append("salary_max", params.salaryMax.toString());
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Adzuna API error: ${response.statusText}`);
      }

      const data = (await response.json()) as AdzunaApiResponse;

      const jobs: JobListing[] = (data.results || []).map((job) =>
        this.normalizeJob(job, country)
      );

      return {
        jobs,
        total: data.count || 0,
        page,
        totalPages: Math.ceil((data.count || 0) / limit),
        source: this.name,
      };
    } catch (error) {
      console.error("Adzuna API error:", error);
      throw error;
    }
  }

  async getJobDetail(externalId: string): Promise<JobListing | null> {
    void externalId;
    // For this implementation, we'd need to fetch from the job redirect URL
    // Adzuna provides a redirect_url that we can follow
    // For now, return null as the search results already contain detail
    return null;
  }

  supportsLocation(location: string, country?: string): boolean {
    void location;
    // Adzuna supports most countries, but has specific endpoints
    const supportedCountries = ["us", "gb", "ca", "au", "in", "nl", "fr", "de"];
    const countryCode = (country || "us").toLowerCase();
    return supportedCountries.includes(countryCode);
  }

  getSupportedCountries(): string[] {
    return ["US", "GB", "CA", "AU", "IN", "NL", "FR", "DE", "IT", "ES", "SE"];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/job_search/us/search/1?app_id=${this.appId}&app_key=${this.appKey}&results_per_page=1&what=test`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit() {
    return this.rateLimiter.getStatus();
  }

  private normalizeJob(adzunaJob: AdzunaApiJob, country: string): JobListing {
    void country;

    return {
      id: `adzuna_${adzunaJob.id}`,
      externalId: adzunaJob.id?.toString(),
      title: adzunaJob.title || "",
      company: adzunaJob.company?.display_name || "Unknown",
      location: adzunaJob.location?.display_name || "Remote",
      isRemote: adzunaJob.location?.display_name?.toLowerCase().includes("remote") || false,
      description: adzunaJob.description || "",
      salary: this.normalizeSalaryRange(adzunaJob.salary_min, adzunaJob.salary_max),
      jobType: adzunaJob.contract_type || "Full-time",
      postedDate: adzunaJob.created || new Date().toISOString(),
      applicationUrl: adzunaJob.redirect_url || "",
      source: this.name,
      externalUrl: adzunaJob.redirect_url || "",
      skills: extractSkillsFromDescription(adzunaJob.description || "", COMMON_SKILLS),
      fetchedAt: new Date().toISOString(),
    };
  }

  private normalizeSalaryRange(
    salaryMin?: number,
    salaryMax?: number
  ): { min?: number; max?: number; currency: string } | undefined {
    if (!salaryMin && !salaryMax) return undefined;

    return {
      min: salaryMin,
      max: salaryMax,
      currency: "GBP", // Adzuna uses GBP as default
    };
  }
}

/**
 * Factory function to create Adzuna source
 */
export function createAdzunaSource(): AdzunaJobSource {
  return new AdzunaJobSource();
}
