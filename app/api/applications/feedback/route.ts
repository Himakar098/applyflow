import { NextRequest, NextResponse } from "next/server";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import type {
  ApplicationFeedbackRecord,
  ApplicationOutcome,
} from "@/lib/recommendations/feedback-learner";

function handleError(error: unknown, scope: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(scope, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * POST /api/applications/feedback
 * Record outcome feedback for a job application
 * Contributes to the feedback learning system for better recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyIdToken(request);
    const uid = authResult.uid;

    const body = await request.json();
    const { jobId, recommendationId, outcome, userFeedback, jobMetadata } = body;

    // Validate required fields
    if (!jobId || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields: jobId, outcome" },
        { status: 400 }
      );
    }

    const validOutcomes: ApplicationOutcome[] = [
      "applied",
      "rejected",
      "ghosted",
      "interview",
      "offer",
      "negotiating",
      "accepted",
      "declined",
    ];
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch the job application to get metadata
    const jobRef = adminDb.collection(`users/${uid}/jobs`).doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: "Job application not found" },
        { status: 404 }
      );
    }

    const jobData = jobDoc.data();

    // Create feedback record
    const feedbackRecord: ApplicationFeedbackRecord = {
      jobId,
      recommendationId,
      jobMetadata: jobMetadata || {
        role: jobData?.title || "Unknown",
        company: jobData?.company || "Unknown",
        location: jobData?.location || "Unknown",
        industry: jobData?.industry,
        isRemote: jobData?.isRemote,
        isHybrid: jobData?.isHybrid,
        skillsRequired: jobData?.skillsRequired,
        seniorityLevel: jobData?.seniorityLevel,
      },
      outcome,
      userFeedback,
      timestamp: new Date().toISOString(),
    };

    // Save feedback record
    const feedbackId = adminDb
      .collection(`users/${uid}/application-feedback`)
      .doc().id;
    await adminDb
      .collection(`users/${uid}/application-feedback`)
      .doc(feedbackId)
      .set(feedbackRecord);

    // Update job application with feedback
    await jobRef.update({
      feedback: {
        outcome,
        recordedAt: new Date().toISOString(),
        userNotes: userFeedback,
      },
      updatedAt: new Date().toISOString(),
    });

    // Log analytics event
    const eventRef = adminDb
      .collection(`users/${uid}/gamification`)
      .doc(new Date().toISOString().split("T")[0]);
    const existingGamification = await eventRef.get();

    const existingEvents = existingGamification.data()?.events || {};
    const eventKey = `outcome_${outcome}`;
    existingEvents[eventKey] = (existingEvents[eventKey] || 0) + 1;

    await eventRef.set(
      {
        events: existingEvents,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json(
      {
        success: true,
        feedbackId,
        message: "Feedback recorded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error, "Error recording application feedback:");
  }
}

/**
 * GET /api/applications/feedback
 * Get feedback records for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    const feedbackSnapshot = await adminDb
      .collection(`users/${uid}/application-feedback`)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const feedbackRecords = feedbackSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(
      {
        success: true,
        feedbackRecords,
        total: feedbackRecords.length,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error, "Error fetching application feedback:");
  }
}
