import { NextRequest, NextResponse } from "next/server";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import {
  buildCareerProfile,
  scoreJobWithAI,
  explainJobMatch,
  isCareerProfileValid,
} from "@/lib/ai/personalization";
import type { CareerProfile } from "@/lib/ai/personalization";
import { getJobSourceManager } from "@/lib/job-sources/manager";
import {
  analyzeFeedbackPatterns,
  applyFeedbackAdjustment,
  generateFeedbackInsights,
} from "@/lib/recommendations/feedback-learner";
import type { ApplicationFeedbackRecord } from "@/lib/recommendations/feedback-learner";
import { scoreJobs } from "@/lib/recommendations/match";
import type { JobListing } from "@/lib/job-sources";
import type { RecommendedJob } from "@/lib/recommendations/types";
import type { Profile, JobApplication } from "@/lib/types";

export const runtime = "nodejs";

function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Error in enhanced recommendations:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

interface EnhancedRecommendedJob extends RecommendedJob {
  aiMatchReason?: string;
  feedbackAdjustment?: number;
  dataSource?: string;
  aiScore?: number;
}

/**
 * POST /api/recommendations/enhanced
 * Enhanced recommendations with AI personalization, multi-source search, and feedback learning
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    const body = await request.json();
    const {
      query,
      location,
      remote,
      jobType,
      country = "US",
      limit = 20,
      sources = ["adzuna", "ziprecruiter", "github", "remoteok"],
      useAIPersonalization = true,
      useFeedbackLearning = true,
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing search query" },
        { status: 400 }
      );
    }

    // Fetch user profile
    const profileDoc = await adminDb
      .collection(`users/${uid}/profile`)
      .doc("current")
      .get();

    const profile: Profile | undefined = profileDoc.data() as Profile;
    if (!profile) {
      return NextResponse.json(
        { error: "Complete your profile before requesting recommendations" },
        { status: 400 }
      );
    }

    // Fetch career profile (cached, updated weekly)
    let careerProfile: CareerProfile | null = null;
    if (useAIPersonalization && profile) {
      const careerProfileDoc = await adminDb
        .collection(`users/${uid}/meta`)
        .doc("careerProfile")
        .get();

      const existingCareerProfile = careerProfileDoc.data() as CareerProfile | undefined;

      if (
        existingCareerProfile &&
        isCareerProfileValid(existingCareerProfile)
      ) {
        careerProfile = existingCareerProfile;
      } else {
        // Build new career profile
        const recentApplications = await adminDb
          .collection(`users/${uid}/jobs`)
          .orderBy("updatedAt", "desc")
          .limit(20)
          .get();

        const jobs = recentApplications.docs.map((doc) => doc.data());

        try {
          careerProfile = await buildCareerProfile(uid, profile, jobs as JobApplication[]);

          // Cache it
          await adminDb
            .collection(`users/${uid}/meta`)
            .doc("careerProfile")
            .set(careerProfile);
        } catch (error) {
          console.error("Error building career profile:", error);
          // Continue without AI personalization if it fails
        }
      }
    }

    // Fetch feedback patterns
    let feedbackPatterns = null;
    let feedbackInsights: string[] = [];
    if (useFeedbackLearning) {
      const feedbackSnapshot = await adminDb
        .collection(`users/${uid}/application-feedback`)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      const feedbackRecords = feedbackSnapshot.docs.map(
        (doc) => doc.data() as ApplicationFeedbackRecord
      );

      if (feedbackRecords.length > 0) {
        feedbackPatterns = analyzeFeedbackPatterns(feedbackRecords);
        feedbackInsights = generateFeedbackInsights(feedbackRecords);
      }
    }

    // Search jobs from multiple sources
    const jobSourceManager = getJobSourceManager();
    const searchParams = {
      query,
      location,
      remote,
      jobType,
      country,
      limit: Math.min(limit * 2, 100), // Get more to filter and score
    };

    const searchResults = await jobSourceManager.searchAll(searchParams, sources);
    const allJobs = searchResults.flatMap((result) => result.jobs);

    if (allJobs.length === 0) {
      return NextResponse.json(
        {
          success: true,
          recommendations: [],
          careerProfile,
          feedbackInsights,
          totalJobs: 0,
          message: "No jobs found matching your criteria",
        },
        { status: 200 }
      );
    }

    // Score jobs using traditional algorithm
    const scoredJobs = scoreJobs(profile, allJobs);

    // Enhance with AI and feedback scoring
    const enhancedRecommendations: EnhancedRecommendedJob[] = [];

    for (const scoredJob of scoredJobs) {
      let aiScore = 50; // Default neutral score
      let aiMatchReason = "";
      let feedbackAdjustment = 0;
      const sourceJob = allJobs.find((job) => job.id === scoredJob.id) as
        | JobListing
        | undefined;

      // Get AI personalization score
      if (useAIPersonalization && careerProfile) {
        try {
          const aiScores = await scoreJobWithAI(
            {
              title: scoredJob.title,
              description: scoredJob.description || "",
              company: scoredJob.company,
              industry: sourceJob?.industry,
              seniority: sourceJob?.seniority,
            },
            careerProfile
          );

          aiScore = aiScores.score;
          aiMatchReason = await explainJobMatch(
            {
              title: scoredJob.title,
              description: scoredJob.description || "",
              company: scoredJob.company,
            },
            careerProfile,
            scoredJob.matchScore,
            aiScore
          );
        } catch (error) {
          console.error("Error scoring job with AI:", error);
        }
      }

      // Apply feedback-based adjustments
      if (useFeedbackLearning && feedbackPatterns) {
        feedbackAdjustment = applyFeedbackAdjustment(
          {
            role: scoredJob.title,
            company: scoredJob.company,
            industry: sourceJob?.industry,
            location: scoredJob.location || "Unknown",
            isRemote: sourceJob?.isRemote,
            isHybrid: sourceJob?.isHybrid,
            skillsRequired: sourceJob?.skills,
            seniorityLevel: sourceJob?.seniority,
          },
          feedbackPatterns,
          feedbackPatterns.successFactors
        );
      }

      // Calculate final composite score
      const finalScore = Math.min(
        100,
        Math.max(
          0,
          (scoredJob.matchScore * 0.5 + aiScore * 0.3 + (75 + feedbackAdjustment)) * 0.2
        )
      );

      enhancedRecommendations.push({
        ...scoredJob,
        matchScore: Math.round(finalScore),
        aiScore,
        aiMatchReason,
        feedbackAdjustment,
        dataSource: scoredJob.source,
      });
    }

    // Sort by final score
    enhancedRecommendations.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // Return top N recommendations
    const recommendations = enhancedRecommendations.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        recommendations,
        careerProfile,
        feedbackInsights,
        totalJobs: allJobs.length,
        scoredJobs: enhancedRecommendations.length,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}
