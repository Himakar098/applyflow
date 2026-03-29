/**
 * AutoApply Configuration System
 * Stores and manages user's auto-apply preferences and rules
 */

export type WorkMode = "remote" | "hybrid" | "on-site" | "flexible";

export interface AutoApplyFilters {
  // Score-based filtering
  minScore: number; // 0-100
  maxScore?: number; // optional

  // Location filtering
  locations?: string[]; // Include these locations
  excludeLocations?: string[]; // Exclude these
  workModes?: WorkMode[]; // Preferred work modes

  // Company filtering
  excludeCompanies?: string[]; // Never apply to these companies
  preferredCompanies?: string[]; // Prioritize these

  // Role filtering
  excludeRoles?: string[]; // Avoid these role types
  excludeKeywords?: string[]; // Exclude jobs with these keywords

  // Salary filtering (optional)
  salaryRange?: {
    min?: number;
    max?: number;
  };

  // Industry filtering (optional)
  preferredIndustries?: string[];
  excludeIndustries?: string[];
}

export interface AutoApplyConfig {
  // Enable/disable
  enabled: boolean;

  // Filtering rules
  filters: AutoApplyFilters;

  // Application behavior
  maxApplicationsPerDay: number; // 1-50
  maxApplicationsPerWeek?: number;
  autoSubmit: boolean; // Auto-submit forms or just auto-fill?

  // File handling
  attachResume: boolean; // Auto-attach resume?
  attachCoverLetter?: boolean; // Auto-attach cover letter?
  attachOtherDocuments?: boolean;

  // User notifications
  notifyOnTasksPending: boolean; // Alert when CAPTCHA/MFA needed?
  notifyOnSuccess: boolean; // Alert when successfully applied?
  notifyOnFailure: boolean; // Alert on failures?
  weeklyReviewEmail: boolean; // Send weekly summary?

  // Advanced options
  skipIfApplicationPageUnreachable?: boolean; // Don't apply if company site down
  respectRobotsTxt?: boolean; // Honor robots.txt (be respectful)
  delays?: {
    betweenApplications?: number; // Milliseconds between applications
    beforeSubmit?: number; // Milliseconds before auto-submit
  };

  // Metadata
  createdAt: string;
  updatedAt: string;
  enabledAt?: string; // When auto-apply was turned on
}

/**
 * Default auto-apply configuration
 */
export const DEFAULT_AUTO_APPLY_CONFIG: AutoApplyConfig = {
  enabled: false,
  filters: {
    minScore: 65,
    workModes: ["remote", "hybrid"],
    excludeKeywords: [],
    excludeCompanies: [],
  },
  maxApplicationsPerDay: 5,
  autoSubmit: false, // Conservative: don't auto-submit by default
  attachResume: true,
  attachCoverLetter: false,
  notifyOnTasksPending: true,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  weeklyReviewEmail: true,
  skipIfApplicationPageUnreachable: true,
  respectRobotsTxt: true,
  delays: {
    betweenApplications: 5000, // 5 seconds between applications
    beforeSubmit: 2000, // 2 seconds before auto-submit
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Validates auto-apply configuration
 */
export function validateAutoApplyConfig(config: Partial<AutoApplyConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.filters?.minScore !== undefined) {
    if (config.filters.minScore < 0 || config.filters.minScore > 100) {
      errors.push("minScore must be between 0 and 100");
    }
  }

  if (config.maxApplicationsPerDay !== undefined) {
    if (config.maxApplicationsPerDay < 1 || config.maxApplicationsPerDay > 50) {
      errors.push("maxApplicationsPerDay must be between 1 and 50");
    }
  }

  if (config.filters?.salaryRange) {
    if (
      config.filters.salaryRange.min &&
      config.filters.salaryRange.max &&
      config.filters.salaryRange.min > config.filters.salaryRange.max
    ) {
      errors.push("Salary minimum cannot be greater than maximum");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a job matches auto-apply filters
 */
export function jobMatchesFilters(
  jobData: {
    title: string;
    company: string;
    location?: string;
    score?: number;
    isRemote?: boolean;
    isHybrid?: boolean;
    isOnSite?: boolean;
    salary?: number;
    industry?: string;
    description?: string;
  },
  filters: AutoApplyFilters
): {
  matches: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check score
  if (jobData.score !== undefined) {
    if (jobData.score < filters.minScore) {
      reasons.push(
        `Score ${jobData.score} is below minimum ${filters.minScore}`
      );
    }
    if (filters.maxScore && jobData.score > filters.maxScore) {
      reasons.push(
        `Score ${jobData.score} exceeds maximum ${filters.maxScore}`
      );
    }
  }

  // Check excluded companies
  if (filters.excludeCompanies?.length) {
    if (
      filters.excludeCompanies.some((c) =>
        jobData.company.toLowerCase().includes(c.toLowerCase())
      )
    ) {
      reasons.push(`Company ${jobData.company} is in exclude list`);
    }
  }

  // Check work modes
  if (filters.workModes && filters.workModes.length > 0) {
    const jobWorkMode = jobData.isRemote
      ? "remote"
      : jobData.isHybrid
        ? "hybrid"
        : "on-site";

    if (!filters.workModes.includes(jobWorkMode as WorkMode)) {
      reasons.push(`Work mode "${jobWorkMode}" not in preferred list`);
    }
  }

  // Check locations
  if (filters.locations && filters.locations.length > 0) {
    const matchesLocation = filters.locations.some((loc) =>
      jobData.location?.toLowerCase().includes(loc.toLowerCase())
    );
    if (!matchesLocation && jobData.location !== "Remote") {
      reasons.push(
        `Location "${jobData.location}" not in preferred list`
      );
    }
  }

  // Check excluded locations
  if (filters.excludeLocations?.length) {
    const inExcluded = filters.excludeLocations.some((loc) =>
      jobData.location?.toLowerCase().includes(loc.toLowerCase())
    );
    if (inExcluded) {
      reasons.push(`Location is in exclude list`);
    }
  }

  // Check excluded keywords
  if (filters.excludeKeywords?.length) {
    const jobText = `${jobData.title} ${jobData.description || ""}`.toLowerCase();
    const hasExcludedKeyword = filters.excludeKeywords.some((kw) =>
      jobText.includes(kw.toLowerCase())
    );
    if (hasExcludedKeyword) {
      reasons.push("Job contains excluded keywords");
    }
  }

  // Check excluded roles
  if (filters.excludeRoles?.length) {
    const inExcludedRoles = filters.excludeRoles.some((role) =>
      jobData.title.toLowerCase().includes(role.toLowerCase())
    );
    if (inExcludedRoles) {
      reasons.push("Role type is in exclude list");
    }
  }

  // Check salary
  if (filters.salaryRange) {
    if (
      jobData.salary &&
      filters.salaryRange.min &&
      jobData.salary < filters.salaryRange.min
    ) {
      reasons.push(
        `Salary ${jobData.salary} is below minimum ${filters.salaryRange.min}`
      );
    }
    if (
      jobData.salary &&
      filters.salaryRange.max &&
      jobData.salary > filters.salaryRange.max
    ) {
      reasons.push(
        `Salary ${jobData.salary} exceeds maximum ${filters.salaryRange.max}`
      );
    }
  }

  // Check industry
  if (filters.preferredIndustries?.length) {
    if (jobData.industry) {
      const matchesIndustry = filters.preferredIndustries.some((ind) =>
        jobData.industry?.toLowerCase().includes(ind.toLowerCase())
      );
      if (!matchesIndustry) {
        reasons.push(
          `Industry "${jobData.industry}" not in preferred list`
        );
      }
    }
  }

  if (filters.excludeIndustries?.length) {
    if (jobData.industry) {
      const inExcludedIndustry = filters.excludeIndustries.some((ind) =>
        jobData.industry?.toLowerCase().includes(ind.toLowerCase())
      );
      if (inExcludedIndustry) {
        reasons.push("Industry is in exclude list");
      }
    }
  }

  return {
    matches: reasons.length === 0,
    reasons,
  };
}
