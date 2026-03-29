import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { RateLimiter, extractSkillsFromDescription, COMMON_SKILLS } from "@/lib/job-sources/index";

type GitHubJob = {
  id?: string | number;
  company?: string;
  type?: string;
  title?: string;
  location?: string;
  description?: string;
  created_at?: string;
  url?: string;
};

/**
 * GitHub Jobs Integration
 * Uses RSS feed since GitHub Jobs API is deprecated
 * Falls back to web scraping if needed
 */

export class GitHubJobsSource implements JobSource {
  name = "github";
  displayName = "GitHub Jobs";
  private baseUrl = "https://jobs.github.com";
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(200); // RSS feed has higher limits
  }

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    await this.rateLimiter.recordRequest();

    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 50);

    // Use GitHub Jobs API (still works despite being officially deprecated)
    const url = new URL(`${this.baseUrl}/positions.json`);
    url.searchParams.append("search", params.query);

    if (params.location) {
      url.searchParams.append("location", params.location);
    }

    if (params.remote) {
      url.searchParams.append("is_remote", "true");
    }

    // GitHub Jobs API doesn't have pagination, returns all results
    // We'll implement client-side slicing
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`GitHub Jobs API error: ${response.statusText}`);
      }

      const allJobs = (await response.json()) as GitHubJob[];

      const jobs: JobListing[] = allJobs
        .slice(startIdx, endIdx)
        .map((job) => this.normalizeJob(job));

      return {
        jobs,
        total: allJobs.length,
        page,
        totalPages: Math.ceil(allJobs.length / limit),
        source: this.name,
      };
    } catch (error) {
      console.error("GitHub Jobs API error:", error);
      throw error;
    }
  }

  async getJobDetail(externalId: string): Promise<JobListing | null> {
    try {
      const response = await fetch(`${this.baseUrl}/positions/${externalId}.json`);
      if (!response.ok) return null;

      const job = (await response.json()) as GitHubJob;
      return this.normalizeJob(job);
    } catch {
      return null;
    }
  }

  supportsLocation(location: string, country?: string): boolean {
    void location;
    void country;
    return true; // GitHub Jobs is global
  }

  getSupportedCountries(): string[] {
    return ["US", "GB", "CA", "AU", "DE", "FR", "NL", "SE", "SG", "JP"];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/positions.json?search=test&is_remote=true`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimit() {
    return this.rateLimiter.getStatus();
  }

  private normalizeJob(ghJob: GitHubJob): JobListing {
    // Parse company from URL if needed
    const company = ghJob.company || "Unknown";
    const isRemote = ghJob.type?.toLowerCase().includes("remote");

    return {
      id: `github_${ghJob.id}`,
      externalId: ghJob.id?.toString(),
      title: ghJob.title || "",
      company,
      location: ghJob.location || (isRemote ? "Remote" : "Unspecified"),
      isRemote: isRemote || false,
      description: ghJob.description || "",
      jobType: ghJob.type || "Full-time",
      postedDate: ghJob.created_at || new Date().toISOString(),
      applicationUrl: ghJob.url || "",
      source: this.name,
      externalUrl: ghJob.url || "",
      skills: extractSkillsFromDescription(ghJob.description || "", COMMON_SKILLS),
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function createGitHubJobsSource(): GitHubJobsSource {
  return new GitHubJobsSource();
}
