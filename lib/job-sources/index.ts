/**
 * Job Source Interface & Types
 * Abstract interface for different job board APIs
 */

export interface JobSearchParams {
  query: string; // Job title/keyword search
  location?: string;
  country?: string; // ISO country code (US, GB, AU, CA, etc)
  remote?: boolean;
  distance?: number; // Km radius for location
  postedWithin?: number; // Days (e.g., 7 = jobs posted in last 7 days)
  jobType?: string; // Full-time, part-time, contract, etc
  salaryMin?: number;
  salaryMax?: number;
  industry?: string;
  page?: number;
  limit?: number;
}

export interface JobListing {
  id: string;
  externalId?: string; // ID from the job board
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  isHybrid?: boolean;
  description: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  jobType?: string; // Full-time, Part-time, Contract, etc
  industry?: string;
  seniority?: string; // Entry, Mid, Senior, etc
  postedDate: string; // ISO date
  applicationUrl: string;
  source: string; // "adzuna", "glassdoor", "ziprecruiter", etc
  externalUrl: string;
  skills?: string[];
  benefits?: string[];

  // Metadata
  fetchedAt: string;
}

export interface JobSearchResult {
  jobs: JobListing[];
  total: number;
  page: number;
  totalPages: number;
  source: string;
}

export interface JobSource {
  name: string; // "adzuna", "glassdoor", "ziprecruiter", etc
  displayName: string; // "Adzuna", "Glassdoor", etc

  /**
   * Search for jobs
   */
  search(params: JobSearchParams): Promise<JobSearchResult>;

  /**
   * Get detailed job information
   */
  getJobDetail(externalId: string): Promise<JobListing | null>;

  /**
   * Check if this source supports the given location
   */
  supportsLocation(location: string, country?: string): boolean;

  /**
   * Get supported countries for this source
   */
  getSupportedCountries(): string[];

  /**
   * Check if source is currently available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get rate limit information
   */
  getRateLimit(): { remaining: number; resetAt: Date };
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private remaining: number;
  private resetAt: Date;
  private requestsPerHour: number;

  constructor(requestsPerHour: number = 100) {
    this.requestsPerHour = requestsPerHour;
    this.remaining = requestsPerHour;
    this.resetAt = new Date(Date.now() + 60 * 60 * 1000);
  }

  async waitIfNeeded(): Promise<void> {
    if (this.remaining <= 0) {
      const now = new Date();
      const delay = this.resetAt.getTime() - now.getTime();
      if (delay > 0) {
        console.log(`Rate limit hit. Waiting ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.remaining = this.requestsPerHour;
        this.resetAt = new Date(Date.now() + 60 * 60 * 1000);
      }
    }
  }

  async recordRequest(): Promise<void> {
    await this.waitIfNeeded();
    this.remaining--;
  }

  getStatus(): { remaining: number; resetAt: Date } {
    return {
      remaining: Math.max(0, this.remaining),
      resetAt: this.resetAt,
    };
  }

  reset(): void {
    this.remaining = this.requestsPerHour;
    this.resetAt = new Date(Date.now() + 60 * 60 * 1000);
  }
}

/**
 * Deduplicates jobs across multiple sources
 * Uses company + job title as dedup key
 */
export function deduplicateJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  const deduplicated: JobListing[] = [];

  for (const job of jobs) {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(job);
    }
  }

  return deduplicated;
}

/**
 * Normalizes salary format across sources
 */
export function normalizeSalary(
  salary: string | number | undefined,
  currency: string = "USD"
): { min?: number; max?: number; currency: string } | undefined {
  if (!salary) return undefined;

  if (typeof salary === "number") {
    return { min: salary, currency };
  }

  // Parse salary range strings like "$50,000 - $70,000"
  const salaryStr = salary.toString().toUpperCase();
  const matches = salaryStr.match(/\$?([\d,]+)/g);

  if (matches && matches.length >= 1) {
    const amounts = matches.map((m) => parseInt(m.replace(/[^\d]/g, "")));
    return {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      currency,
    };
  }

  return undefined;
}

/**
 * Extracts skills from job description
 */
export function extractSkillsFromDescription(
  description: string,
  commonSkills: Set<string>
): string[] {
  const skills: Set<string> = new Set();
  const lowerDesc = description.toLowerCase();

  for (const skill of commonSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  return Array.from(skills);
}

/**
 * Common technical skills to look for in job descriptions
 */
export const COMMON_SKILLS = new Set([
  // Languages
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "SQL",

  // Frameworks & Libraries
  "React",
  "Vue",
  "Angular",
  "Django",
  "Flask",
  "Spring",
  "Express",
  "FastAPI",

  // Cloud & Deployment
  "AWS",
  "Azure",
  "GCP",
  "Kubernetes",
  "Docker",
  "CI/CD",

  // Data & Databases
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "REST",

  // Soft Skills (often mentioned implicitly)
  "Leadership",
  "Problem Solving",
  "Communication",
  "Team Player",
  "Project Management",
]);
