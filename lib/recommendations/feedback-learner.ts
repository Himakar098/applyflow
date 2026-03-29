import type { ApplicationOutcome } from "@/lib/types";

/**
 * Feedback learning system for recommendations
 * Tracks user outcomes and adjusts recommendation weights based on what worked
 */

export type { ApplicationOutcome };

export interface ApplicationFeedbackRecord {
  jobId: string;
  recommendationId?: string;
  jobMetadata: {
    role: string;
    company: string;
    industry?: string;
    location: string;
    isRemote?: boolean;
    isHybrid?: boolean;
    skillsRequired?: string[];
    seniorityLevel?: string;
    estimatedSalary?: number;
  };
  outcome: ApplicationOutcome;
  userFeedback?: string;
  timestamp: string;
}

export interface FeedbackWeights {
  // Company type weights
  companySize: Record<string, number>;
  industryPreference: Record<string, number>;

  // Work modes
  workModePreference: {
    remote: number;
    hybrid: number;
    onsite: number;
  };

  // Location preferences learned
  locationPreference: Record<string, number>;

  // Role type preferences
  roleTypePreference: Record<string, number>;

  // Seniority preferences
  seniorityPreference: Record<string, number>;
}

/**
 * Analyzes application outcomes to determine what factors lead to success
 */
export function analyzeFeedbackPatterns(feedbackRecords: ApplicationFeedbackRecord[]): {
  successFactors: Record<string, number>;
  rejectionFactors: Record<string, number>;
  successRate: number;
} {
  if (feedbackRecords.length === 0) {
    return {
      successFactors: {},
      rejectionFactors: {},
      successRate: 0,
    };
  }

  const successfulApplications = feedbackRecords.filter(
    (f) => f.outcome === "interview" || f.outcome === "offer" || f.outcome === "accepted"
  );

  const successRate = successfulApplications.length / feedbackRecords.length;

  // Analyze patterns in successful applications
  const successFactors: Record<string, number> = {};
  const rejectionFactors: Record<string, number> = {};

  // Company patterns
  const successByCompany: Record<string, number> = {};
  const totalByCompany: Record<string, number> = {};

  for (const feedback of feedbackRecords) {
    const company = feedback.jobMetadata.company;
    totalByCompany[company] = (totalByCompany[company] || 0) + 1;

    if (successfulApplications.includes(feedback)) {
      successByCompany[company] = (successByCompany[company] || 0) + 1;
    }
  }

  // Calculate company success rates
  for (const company in totalByCompany) {
    const successRatio = (successByCompany[company] || 0) / totalByCompany[company];
    if (successRatio > 0.5) {
      successFactors[`company:${company}`] = successRatio * 20; // Boost to +20
    } else if (successRatio < 0.3) {
      rejectionFactors[`company:${company}`] = (1 - successRatio) * -20; // Penalize to -20
    }
  }

  // Industry patterns
  const successByIndustry: Record<string, number> = {};
  const totalByIndustry: Record<string, number> = {};

  for (const feedback of feedbackRecords) {
    const industry = feedback.jobMetadata.industry || "Unknown";
    totalByIndustry[industry] = (totalByIndustry[industry] || 0) + 1;

    if (successfulApplications.includes(feedback)) {
      successByIndustry[industry] = (successByIndustry[industry] || 0) + 1;
    }
  }

  for (const industry in totalByIndustry) {
    const successRatio = (successByIndustry[industry] || 0) / totalByIndustry[industry];
    if (successRatio > 0.6) {
      successFactors[`industry:${industry}`] = successRatio * 15;
    } else if (successRatio < 0.25) {
      rejectionFactors[`industry:${industry}`] = (1 - successRatio) * -15;
    }
  }

  // Work mode patterns
  const successByWorkMode: Record<string, number> = {};
  const totalByWorkMode: Record<string, number> = {};

  for (const feedback of feedbackRecords) {
    let workMode = "onsite";
    if (feedback.jobMetadata.isRemote) workMode = "remote";
    else if (feedback.jobMetadata.isHybrid) workMode = "hybrid";

    totalByWorkMode[workMode] = (totalByWorkMode[workMode] || 0) + 1;

    if (successfulApplications.includes(feedback)) {
      successByWorkMode[workMode] = (successByWorkMode[workMode] || 0) + 1;
    }
  }

  for (const workMode in totalByWorkMode) {
    const successRatio = (successByWorkMode[workMode] || 0) / totalByWorkMode[workMode];
    if (successRatio > 0.5) {
      successFactors[`workMode:${workMode}`] = successRatio * 10;
    }
  }

  return {
    successFactors,
    rejectionFactors,
    successRate,
  };
}

/**
 * Applies learned weights to a job score
 * Returns adjusted score based on feedback patterns
 */
export function applyFeedbackAdjustment(
  jobMetadata: ApplicationFeedbackRecord["jobMetadata"],
  feedbackPatterns: ReturnType<typeof analyzeFeedbackPatterns>,
  successFactors: Record<string, number> = {}
): number {
  let adjustment = 0;

  // Check success factors
  for (const [factor, weight] of Object.entries(successFactors)) {
    if (factor.startsWith("company:") && factor.includes(jobMetadata.company)) {
      adjustment += weight;
    }
    if (factor.startsWith("industry:") && factor.includes(jobMetadata.industry || "")) {
      adjustment += weight;
    }
    if (factor.startsWith("workMode:")) {
      const workMode = jobMetadata.isRemote
        ? "remote"
        : jobMetadata.isHybrid
          ? "hybrid"
          : "onsite";
      if (factor.includes(workMode)) {
        adjustment += weight;
      }
    }
  }

  // Cap adjustment between -30 and +30
  return Math.max(-30, Math.min(30, adjustment));
}

/**
 * Extracts insights from feedback patterns to recommend actions
 */
export function generateFeedbackInsights(
  feedbackRecords: ApplicationFeedbackRecord[]
): string[] {
  const insights: string[] = [];

  if (feedbackRecords.length < 5) {
    return ["Apply to more jobs to build feedback patterns for better recommendations"];
  }

  const patterns = analyzeFeedbackPatterns(feedbackRecords);

  if (Object.keys(patterns.successFactors).length > 0) {
    const topFactor = Object.entries(patterns.successFactors).sort(
      ([, a], [, b]) => b - a
    )[0];
    insights.push(`You have high success with ${topFactor[0].split(":")[1]} - consider exploring similar opportunities`);
  }

  if (Object.keys(patterns.rejectionFactors).length > 0) {
    const topRejection = Object.entries(patterns.rejectionFactors).sort(
      ([, a], [, b]) => Math.abs(b) - Math.abs(a)
    )[0];
    insights.push(`You may want to reconsider opportunities similar to ${topRejection[0].split(":")[1]}`);
  }

  // Work mode insights
  const remoteApplications = feedbackRecords.filter((f) => f.jobMetadata.isRemote);
  const remoteSuccess =
    remoteApplications.filter(
      (f) => f.outcome === "interview" || f.outcome === "offer"
    ).length / (remoteApplications.length || 1);

  if (remoteSuccess > 0.6 && remoteApplications.length > 3) {
    insights.push("Remote roles have high success rate for you - increase remote job focus");
  }

  return insights;
}
