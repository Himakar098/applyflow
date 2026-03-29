import type { JobSource, JobSearchParams, JobSearchResult, JobListing } from "@/lib/job-sources/index";
import { deduplicateJobs } from "@/lib/job-sources/index";
import { createAdzunaSource } from "@/lib/job-sources/adzuna";
import { createZipRecruiterSource } from "@/lib/job-sources/ziprecruiter";
import { createGitHubJobsSource } from "@/lib/job-sources/github-jobs";
import { createRemoteOKSource } from "@/lib/job-sources/remoteok";
import { createGlassdoorSource } from "@/lib/job-sources/glassdoor";

/**
 * Job Source Manager
 * Handles multiple job sources and deduplication
 */

export class JobSourceManager {
  private sources: Map<string, JobSource>;

  constructor() {
    this.sources = new Map();
    this.registerDefaultSources();
  }

  private registerDefaultSources(): void {
    this.register(createAdzunaSource());
    this.register(createZipRecruiterSource());
    this.register(createGitHubJobsSource());
    this.register(createRemoteOKSource());
    this.register(createGlassdoorSource());
  }

  register(source: JobSource): void {
    this.sources.set(source.name, source);
  }

  getSources(): JobSource[] {
    return Array.from(this.sources.values());
  }

  getSource(name: string): JobSource | undefined {
    return this.sources.get(name);
  }

  /**
   * Search across multiple job sources in parallel
   */
  async searchAll(
    params: JobSearchParams,
    sourceNames?: string[]
  ): Promise<JobSearchResult[]> {
    const sources = sourceNames
      ? sourceNames
          .map((name) => this.sources.get(name))
          .filter((s): s is JobSource => s !== undefined)
      : Array.from(this.sources.values());

    // Only use sources that support the location
    const applicableSources = sources.filter((source) =>
      source.supportsLocation(params.location || "", params.country)
    );

    console.log(
      `Searching across ${applicableSources.length} job sources: ${applicableSources
        .map((s) => s.displayName)
        .join(", ")}`
    );

    // Search all sources in parallel
    const results = await Promise.allSettled(
      applicableSources.map((source) => source.search(params))
    );

    // Filter out failures and combine results
    const successfulResults: JobSearchResult[] = [];
    const allJobs: JobListing[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
        allJobs.push(...result.value.jobs);
      } else {
        console.error(
          `Error searching ${applicableSources[i].displayName}:`,
          result.reason
        );
      }
    }

    // Deduplicate jobs across sources
    const dedupedJobs = deduplicateJobs(allJobs);

    // Return combined result
    return [
      {
        jobs: dedupedJobs,
        total: dedupedJobs.length,
        page: params.page || 1,
        totalPages: 1,
        source: "combined",
      },
    ];
  }

  /**
   * Get health status of all sources
   */
  async getSourceStatus(): Promise<
    Record<string, { available: boolean; rateLimit: { remaining: number; resetAt: string } }>
  > {
    const status: Record<
      string,
      { available: boolean; rateLimit: { remaining: number; resetAt: string } }
    > = {};

    for (const [name, source] of this.sources) {
      try {
        const available = await source.isAvailable();
        const rateLimit = source.getRateLimit();
        status[name] = {
          available,
          rateLimit: {
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt.toISOString(),
          },
        };
      } catch {
        status[name] = {
          available: false,
          rateLimit: {
            remaining: 0,
            resetAt: new Date().toISOString(),
          },
        };
      }
    }

    return status;
  }
}

/**
 * Singleton instance
 */
let manager: JobSourceManager | null = null;

export function getJobSourceManager(): JobSourceManager {
  if (!manager) {
    manager = new JobSourceManager();
  }
  return manager;
}
