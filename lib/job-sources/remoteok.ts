import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { RateLimiter, extractSkillsFromDescription, COMMON_SKILLS } from "@/lib/job-sources/index";

type RemoteOKJob = {
  id?: string | number;
  title?: string;
  company?: string;
  description?: string;
  tag?: string;
  salary_max?: number;
  salary_min?: number;
  job_type?: string;
  epoch?: string | number;
  url?: string;
};

/**
 * RemoteOK Job Board Integration
 * Specialized in remote work jobs
 * Uses RSS feed: https://remoteok.io/feed
 */

export class RemoteOKJobSource implements JobSource {
  name = "remoteok";
  displayName = "RemoteOK";
  private baseUrl = "https://remoteok.io";
  private apiUrl = "https://remoteok.io/api";
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(100); // 100 requests/hour
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    await this.rateLimiter.recordRequest();

    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 200);

    try {
      // RemoteOK API returns jobs as JSON via their API endpoint
      const response = await fetch(`${this.apiUrl}/jobs`);
      if (!response.ok) {
        throw new Error(`RemoteOK API error: ${response.statusText}`);
      }

      let allJobs = (await response.json()) as RemoteOKJob[];

      // Filter by search query
      if (params.query) {
        const query = params.query.toLowerCase();
        allJobs = allJobs.filter(
          (job) =>
            job.title?.toLowerCase().includes(query) ||
            job.company?.toLowerCase().includes(query) ||
            job.description?.toLowerCase().includes(query)
        );
      }

      // Filter by location (tags in RemoteOK)
      if (params.location) {
        const locQuery = params.location.toLowerCase();
        allJobs = allJobs.filter((job) => {
          if (params.location === "remote" || params.location === "worldwide") {
            return true; // All RemoteOK jobs are remote by nature
          }
          // Filter by country tags if specified
          const tags = (job.tag || "").toLowerCase();
          return tags.includes(locQuery);
        });
      }

      // Filter by salary if specified
      if (params.salaryMin || params.salaryMax) {
        allJobs = allJobs.filter((job) => {
          if (!job.salary_max && !job.salary_min) return true;
          const salary = job.salary_max || job.salary_min || 0;
          if (params.salaryMin && salary < params.salaryMin) return false;
          if (params.salaryMax && salary > params.salaryMax) return false;
          return true;
        });
      }

      // Pagination
      const startIdx = (page - 1) * limit;
      const endIdx = startIdx + limit;
      const paginatedJobs = allJobs.slice(startIdx, endIdx);

      const jobs: JobListing[] = paginatedJobs.map((job) => this.normalizeJob(job));

      return {
        jobs,
        total: allJobs.length,
        page,
        totalPages: Math.ceil(allJobs.length / limit),
        source: this.name,
      };
    } catch (error) {
      console.error("RemoteOK API error:", error);
      throw error;
    }
  }

  async getJobDetail(externalId: string): Promise<JobListing | null> {
    void externalId;
    // RemoteOK provides limited data in list view
    // For details, we'd need to scrape the job page
    return null;
  }

  supportsLocation(location: string, country?: string): boolean {
    void location;
    void country;
    return true; // RemoteOK is global/remote by nature
  }

  getSupportedCountries(): string[] {
    return [
      "US", "GB", "CA", "AU", "DE", "FR", "NL", "SE", "CH", "IN",
      "BR", "JP", "SG", "NZ", "ZA"
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/jobs`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit() {
    return this.rateLimiter.getStatus();
  }

  private normalizeJob(rokJob: RemoteOKJob): JobListing {
    // RemoteOK markup includes HTML tags in description
    const cleanDesc = this.cleanHTML(rokJob.description || "");

    return {
      id: `remoteok_${rokJob.id}`,
      externalId: rokJob.id?.toString(),
      title: rokJob.title || "",
      company: rokJob.company || "Unknown",
      location: "Remote",
      isRemote: true,
      description: cleanDesc,
      salary: this.extractSalary(rokJob),
      jobType: rokJob.job_type || "Full-time",
      postedDate: new Date(String(rokJob.epoch) + "000").toISOString(),
      applicationUrl: `${this.baseUrl}/${rokJob.url || ""}`,
      source: this.name,
      externalUrl: `${this.baseUrl}/${rokJob.url || ""}`,
      skills: extractSkillsFromDescription(cleanDesc, COMMON_SKILLS),
      fetchedAt: new Date().toISOString(),
    };
  }

  private cleanHTML(html: string): string {
    if (!html) return "";
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .trim();
  }

  private extractSalary(
    rokJob: RemoteOKJob
  ): { min?: number; max?: number; currency: string } | undefined {
    if (rokJob.salary_max || rokJob.salary_min) {
      return {
        min: rokJob.salary_min,
        max: rokJob.salary_max,
        currency: "USD",
      };
    }
    return undefined;
  }
}

export function createRemoteOKSource(): RemoteOKJobSource {
  return new RemoteOKJobSource();
}
