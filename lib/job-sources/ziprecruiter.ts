import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { RateLimiter, extractSkillsFromDescription, COMMON_SKILLS } from "@/lib/job-sources/index";

type ZipRecruiterApiJob = {
  id?: string | number;
  name?: string;
  hiring_company?: { name?: string };
  location?: { display_name?: string };
  work_location?: string;
  job_description?: string;
  salary?: {
    min_annual_salary?: number;
    max_annual_salary?: number;
  };
  employment_type?: string;
  posted_time_friendly?: string;
  url?: string;
};

type ZipRecruiterApiResponse = {
  jobs?: ZipRecruiterApiJob[];
  total_jobs?: number;
};

/**
 * ZipRecruiter Job Board Integration
 * https://www.ziprecruiter.com/api/
 */

export class ZipRecruiterJobSource implements JobSource {
  name = "ziprecruiter";
  displayName = "ZipRecruiter";
  private apiKey: string;
  private baseUrl = "https://api.ziprecruiter.com/jobs/v1";
  private rateLimiter: RateLimiter;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ZIPRECRUITER_API_KEY || "";
    this.rateLimiter = new RateLimiter(50);
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    if (!this.apiKey) {
      throw new Error("ZipRecruiter API key not configured");
    }

    await this.rateLimiter.recordRequest();

    const page = params.page || 0;
    const limit = Math.min(params.limit || 50, 100);

    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.append("api_key", this.apiKey);
    url.searchParams.append("search", params.query);
    url.searchParams.append("location", params.location || "");
    url.searchParams.append("page", page.toString());
    url.searchParams.append("jobs_per_page", limit.toString());

    if (params.remote) {
      url.searchParams.append("remote", "true");
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
        throw new Error(`ZipRecruiter API error: ${response.statusText}`);
      }

      const data = (await response.json()) as ZipRecruiterApiResponse;

      const jobs: JobListing[] = (data.jobs || []).map((job) =>
        this.normalizeJob(job)
      );

      return {
        jobs,
        total: data.total_jobs || 0,
        page,
        totalPages: Math.ceil((data.total_jobs || 0) / limit),
        source: this.name,
      };
    } catch (error) {
      console.error("ZipRecruiter API error:", error);
      throw error;
    }
  }

  async getJobDetail(externalId: string): Promise<JobListing | null> {
    void externalId;
    return null;
  }

  supportsLocation(location: string, country?: string): boolean {
    void location;
    void country;
    return true; // ZipRecruiter primarily serves US
  }

  getSupportedCountries(): string[] {
    return ["US"];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?api_key=${this.apiKey}&search=test&location=&jobs_per_page=1`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit() {
    return this.rateLimiter.getStatus();
  }

  private normalizeJob(zrJob: ZipRecruiterApiJob): JobListing {
    return {
      id: `ziprecruiter_${zrJob.id}`,
      externalId: zrJob.id?.toString(),
      title: zrJob.name || "",
      company: zrJob.hiring_company?.name || "Unknown",
      location: zrJob.location?.display_name || "Remote",
      isRemote: zrJob.location?.display_name?.toLowerCase().includes("remote") || false,
      isHybrid: zrJob.work_location === "hybrid",
      description: zrJob.job_description || "",
      salary: zrJob.salary
        ? {
            min: zrJob.salary.min_annual_salary,
            max: zrJob.salary.max_annual_salary,
            currency: "USD",
          }
        : undefined,
      jobType: zrJob.employment_type || "Full-time",
      postedDate: zrJob.posted_time_friendly || new Date().toISOString(),
      applicationUrl: zrJob.url || "",
      source: this.name,
      externalUrl: zrJob.url || "",
      skills: extractSkillsFromDescription(zrJob.job_description || "", COMMON_SKILLS),
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function createZipRecruiterSource(): ZipRecruiterJobSource {
  return new ZipRecruiterJobSource();
}
