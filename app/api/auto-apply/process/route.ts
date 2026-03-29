import { NextRequest, NextResponse } from "next/server";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { QueueItem } from "@/lib/auto-apply/queue";
import {
  calculateQueueStats,
} from "@/lib/auto-apply/queue";
import type { AutoApplyConfig } from "@/lib/auto-apply/config";
import {
  checkSiteReachability,
  createSubmissionAttempt,
} from "@/lib/auto-apply/submission";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout for Cloud Functions

interface ProcessQueueRequest {
  queueId?: string;
  immediate?: boolean;
}

function handleError(error: unknown, scope: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(scope, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * POST /api/auto-apply/process
 * Process a specific queue item or trigger scheduler
 * Can be called manually or by Cloud Scheduler
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    const { queueId, immediate = false } = (await request.json()) as ProcessQueueRequest;

    if (!queueId && !immediate) {
      return NextResponse.json(
        { error: "Missing queueId or immediate flag" },
        { status: 400 }
      );
    }

    // Get user's auto-apply config
    const configDoc = await adminDb
      .collection(`users/${uid}/settings`)
      .doc("auto-apply")
      .get();

    const config = configDoc.data() as AutoApplyConfig | undefined;

    if (!config?.enabled) {
      return NextResponse.json(
        { error: "Auto-apply is disabled for this user" },
        { status: 400 }
      );
    }

    if (queueId) {
      // Process specific queue item
      const result = await processSpecificQueueItem(uid, queueId, config);
      return NextResponse.json(result, { status: 200 });
    } else {
      // Process next pending item
      const result = await processNextQueueItem(uid, config);
      return NextResponse.json(result, { status: 200 });
    }
  } catch (error) {
    return handleError(error, "Error processing queue:");
  }
}

/**
 * GET /api/auto-apply/process
 * Get queue stats and status
 */
export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    // Get queue stats
    const queueSnapshot = await adminDb
      .collection(`users/${uid}/auto-apply-queue`)
      .get();

    const queueItems = queueSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as (QueueItem & { id: string })[];

    const stats = calculateQueueStats(queueItems);

    return NextResponse.json(
      {
        success: true,
        stats,
        queueItems: queueItems.slice(0, 10), // Last 10 items
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error, "Error getting queue status:");
  }
}

/**
 * Process a specific queue item
 */
async function processSpecificQueueItem(
  userId: string,
  queueId: string,
  config: AutoApplyConfig
) {
  const docRef = adminDb.collection(`users/${userId}/auto-apply-queue`).doc(queueId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return {
      success: false,
      error: "Queue item not found",
    };
  }

  const item = doc.data() as QueueItem;
  return await processQueueItemWithLogic(userId, queueId, item, docRef, config);
}

/**
 * Process the next pending queue item
 */
async function processNextQueueItem(userId: string, config: AutoApplyConfig) {
  // Get next pending item
  const queueSnapshot = await adminDb
    .collection(`users/${userId}/auto-apply-queue`)
    .where("status", "in", ["pending", "failed"])
    .orderBy("status")
    .orderBy("priority", "desc")
    .orderBy("addedAt")
    .limit(1)
    .get();

  if (queueSnapshot.empty) {
    return {
      success: true,
      message: "No pending items to process",
      processed: 0,
    };
  }

  const doc = queueSnapshot.docs[0];
  const item = doc.data() as QueueItem;
  const docRef = doc.ref;

  return await processQueueItemWithLogic(userId, doc.id, item, docRef, config);
}

/**
 * Core logic for processing a queue item
 */
async function processQueueItemWithLogic(
  userId: string,
  queueId: string,
  item: QueueItem,
  docRef: FirebaseFirestore.DocumentReference,
  config: AutoApplyConfig
) {
  // Mark as processing
  await docRef.update({
    status: "processing",
    processedAt: Timestamp.now(),
  });

  try {
    // Pre-flight checks
    const siteCheck = await checkSiteReachability(item.jobUrl);
    if (!siteCheck.siteReachable) {
      throw new Error("Job site is not reachable");
    }

    // Prepare submission attempt
    const submissionAttempt = createSubmissionAttempt(
      queueId,
      item.jobUrl,
      (item.retryCount ?? 0) + 1,
    );
    submissionAttempt.preChecks = {
      siteReachable: siteCheck.siteReachable,
      formDetectable: siteCheck.formDetected,
      requiredFieldsPresent: siteCheck.applicationPageFound,
      errors: siteCheck.detectedChallenges.length
        ? siteCheck.detectedChallenges
        : undefined,
    };

    // Get user's resume and profile data
    const profileDoc = await adminDb
      .collection(`users/${userId}/profile`)
      .doc("current")
      .get();

    const profile = profileDoc.data();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Create a message for the extension to autofill the form
    // This will be sent via sendToContentScript when user visits job URL
    const autoFillPayload = {
      type: "applyflow:autofill-request",
      payload: {
        profile,
        jobMetadata: item,
        autoApplyConfig: config,
      },
    };

    // Store the autofill request for the extension to pick up
    await adminDb
      .collection(`users/${userId}/extension-requests`)
      .doc("current")
      .set(autoFillPayload, { merge: true });

    // Simulate form filling for now (in production, extension handles this)
    // For MVP, we'll mark as manual_action_needed until user completes form
    submissionAttempt.result.status = "pending_manual_action";
    submissionAttempt.result.message =
      "Form pre-fill prepared. User review is required before submission.";
    submissionAttempt.manualActions = [
      {
        taskType: "form_review",
        description: "Please review the pre-filled form and submit",
        instructions:
          "Visit the job URL and verify all fields are filled correctly before submitting",
      },
    ];

    // Update queue item
    await docRef.update({
      status: "pending_manual_action",
      applicationResult: {
        success: false,
        submittedUrl: item.jobUrl,
        timestamp: new Date().toISOString(),
      },
      manualTasks: submissionAttempt.manualActions,
    });

    // Create user notification task
    const taskId = `task_${Date.now()}`;
    await adminDb
      .collection(`users/${userId}/manual-tasks`)
      .doc(taskId)
      .set({
        id: taskId,
        jobId: item.jobId,
        queueId,
        jobTitle: item.jobTitle || "Unknown",
        company: item.company || "Unknown",
        taskType: "form_review",
        description: "Complete application form",
        instructions: `Visit ${item.jobUrl} to complete your application. The form should be pre-filled with your information.`,
        applicationUrl: item.jobUrl,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        completed: false,
      });

    // Update queue item after the manual task exists
    await docRef.update({
      status: "manual_action_needed",
      applicationResult: {
        success: false,
        submittedUrl: item.jobUrl,
        timestamp: new Date().toISOString(),
      },
      manualTasks: [taskId],
    });

    return {
      success: true,
      status: "manual_action_needed",
      queueId,
      jobUrl: item.jobUrl,
      message: "Form pre-fill prepared. Please complete and submit the application.",
      taskId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error processing queue item ${item.id}:`, error);

    // Determine if retryable
    const retryable =
      !errorMsg.includes("not found") && !errorMsg.includes("form");

    const canRetry = retryable && (item.retryCount ?? 0) < item.maxRetries;

    if (canRetry) {
      // Schedule retry
      const waitMinutes = Math.pow(2, item.retryCount || 0);
      const nextRetryAt = new Date(
        Date.now() + waitMinutes * 60 * 1000
      ).toISOString();

      await docRef.update({
        status: "failed",
        error: {
          message: errorMsg,
          timestamp: new Date().toISOString(),
        },
        lastRetryAt: new Date().toISOString(),
        nextRetryAt,
        retryCount: (item.retryCount || 0) + 1,
      });

      return {
        success: false,
        status: "failed",
        error: errorMsg,
        retryable: true,
        nextRetryAt,
      };
    } else {
      // Give up
      await docRef.update({
        status: "failed",
        error: {
          message: errorMsg,
          code: "max_retries_exceeded",
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: false,
        status: "failed",
        error: errorMsg,
        retryable: false,
      };
    }
  }
}
