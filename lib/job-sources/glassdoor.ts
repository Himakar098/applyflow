import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { RateLimiter, extractSkillsFromDescription, COMMON_SKILLS } from "@/lib/job-sources/index";

type GlassdoorApiJob = {
  jobId?: string | number;
  salaryEst?: string;
  jobTitle?: string;
  employer?: string;
  city?: string;
  state?: string;
  country?: string;
  jobLocation?: string;
  jobDescription?: string;
  jobType?: string;
  postedDate?: string;
  jobLinkUrl?: string;
};

type GlassdoorApiResponse = {
  response?: GlassdoorApiJob[];
  totalRecordCount?: number;
};

/**
 * Glassdoor Job Board Integration
 * Note: Glassdoor doesn't have a public API, so this uses unofficial endpoints
 * For production, consider getting API access via: https://www.glassdoor.com/api/
 */

export class GlassdoorJobSource implements JobSource {
  name = "glassdoor";
  displayName = "Glassdoor";
  private apiKey: string;
  private baseUrl = "https://www.glassdoor.com/api/v2";
  private rateLimiter: RateLimiter;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GLASSDOOR_API_KEY || "";
    this.rateLimiter = new RateLimiter(50); // Conservative rate limit
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    if (!this.apiKey) {
      console.warn("Glassdoor API key not configured, returning empty results");
      return {
        jobs: [],
        total: 0,
        page: params.page || 1,
        totalPages: 0,
        source: this.name,
      };
    }

    await this.rateLimiter.recordRequest();

    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 50);

    try {
      // Note: Actual Glassdoor API call structure
      // This would need official API credentials
      const url = new URL(`${this.baseUrl}/jobs`);
      url.searchParams.append("key", this.apiKey);
      url.searchParams.append("keyword_title", params.query);
      url.searchParams.append("l", params.location || "");
      url.searchParams.append("page", page.toString());
      url.searchParams.append("pagesize", limit.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Glassdoor API error: ${response.statusText}`);
      }

      const data = (await response.json()) as GlassdoorApiResponse;

      const jobs: JobListing[] = (data.response || []).map((job) =>
        this.normalizeJob(job)
      );

      return {
        jobs,
        total: data.totalRecordCount || 0,
        page,
        totalPages: Math.ceil((data.totalRecordCount || 0) / limit),
        source: this.name,
      };
    } catch (error) {
      console.error("Glassdoor API error:", error);
      // Return empty results rather than fail completely
      return {
        jobs: [],
        total: 0,
        page: params.page || 1,
        totalPages: 0,
        source: this.name,
      };
    }
  }

  async getJobDetail(externalId: string): Promise<JobListing | null> {
    if (!this.apiKey) return null;

    try {
      const url = new URL(`${this.baseUrl}/job/${externalId}`);
      url.searchParams.append("key", this.apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const data = (await response.json()) as GlassdoorApiJob;
      return this.normalizeJob(data);
    } catch {
      return null;
    }
  }

  supportsLocation(location: string, country?: string): boolean {
    void location;
    void country;
    // Glassdoor supports most countries but primarily US
    return true;
  }

  getSupportedCountries(): string[] {
    return ["US", "GB", "CA", "AU", "IN", "DE", "FR", "NL", "SG"];
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const url = new URL(`${this.baseUrl}/jobs`);
      url.searchParams.append("key", this.apiKey);
      url.searchParams.append("keyword_title", "Engineer");
      url.searchParams.append("pagesize", "1");

      const response = await fetch(url.toString());
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit() {
    return this.rateLimiter.getStatus();
  }

  private normalizeJob(gdJob: GlassdoorApiJob): JobListing {
    let salary: { min?: number; max?: number; currency: string } | undefined;

    if (gdJob.salaryEst) {
      const salaryStr = gdJob.salaryEst.match(/\d+/g);
      if (salaryStr && salaryStr.length >= 2) {
        salary = {
          min: parseInt(salaryStr[0]) * 1000, // Convert K to actual
          max: parseInt(salaryStr[1]) * 1000,
          currency: "USD",
        };
      }
    }

    return {
      id: `glassdoor_${gdJob.jobId}`,
      externalId: gdJob.jobId?.toString(),
      title: gdJob.jobTitle || "",
      company: gdJob.employer || "Unknown",
      location: `${gdJob.city || ""}, ${gdJob.state || gdJob.country || ""}`.trim(),
      isRemote: gdJob.jobLocation?.includes("Remote") || false,
      description: gdJob.jobDescription || "",
      salary,
      jobType: gdJob.jobType || "Full-time",
      postedDate: gdJob.postedDate ? new Date(gdJob.postedDate).toISOString() : new Date().toISOString(),
      applicationUrl: gdJob.jobLinkUrl || "",
      source: this.name,
      externalUrl: gdJob.jobLinkUrl || "",
      skills: extractSkillsFromDescription(gdJob.jobDescription || "", COMMON_SKILLS),
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function createGlassdoorSource(): GlassdoorJobSource {
  return new GlassdoorJobSource();
}
