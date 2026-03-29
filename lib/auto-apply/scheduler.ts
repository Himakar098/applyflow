import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { QueueItem } from "@/lib/auto-apply/queue";
import { shouldRetry } from "@/lib/auto-apply/queue";
import type { AutoApplyConfig } from "@/lib/auto-apply/config";

/**
 * Auto-Apply Scheduler
 * Processes the application queue at regular intervals
 * Should be triggered by Cloud Tasks, Cron Service, or similar
 */

export interface SchedulerConfig {
  maxItemsPerRun: number; // Max items to process per run
  processingTimeout: number; // Milliseconds before marking as failed
  dailyApplicationLimit: number;
  weeklyApplicationLimitc: number;
  respectedRobotsTxt: boolean;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxItemsPerRun: 5,
  processingTimeout: 120000, // 2 minutes
  dailyApplicationLimit: 10,
  weeklyApplicationLimitc: 50,
  respectedRobotsTxt: true,
};

/**
 * Main scheduler function
 * Processes queue items for all users
 */
export async function runScheduler(config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG) {
  const startTime = Date.now();
  const stats = {
    processed: 0,
    successful: 0,
    failed: 0,
    manualActionNeeded: 0,
    errors: [] as string[],
    totalProcessingTime: 0,
  };

  try {
    // Get all queue items across all users
    const queueSnapshot = await adminDb.collectionGroup("auto-apply-queue")
      .where("status", "in", ["pending", "failed"])
      .orderBy("status")
      .orderBy("priority", "desc")
      .orderBy("addedAt")
      .limit(config.maxItemsPerRun)
      .get();

    const queueItems = queueSnapshot.docs.map((doc) => ({
      ...doc.data(),
      _docRef: doc.ref,
    })) as (QueueItem & { _docRef: FirebaseFirestore.DocumentReference })[];

    console.log(`Scheduler: Processing ${queueItems.length} queue items`);

    // Process each item
    for (const item of queueItems) {
      try {
        const result = await processQueueItem(item, config);
        stats.processed++;

        if (result.status === "submitted") {
          stats.successful++;
        } else if (result.status === "failed") {
          stats.failed++;
        } else if (result.status === "manual_action_needed") {
          stats.manualActionNeeded++;
        }
      } catch (error) {
        stats.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`Failed to process ${item.company} application: ${errorMsg}`);
        console.error(`Error processing queue item ${item.id}:`, error);
      }
    }

    stats.totalProcessingTime = Date.now() - startTime;

    console.log("Scheduler summary:", stats);
    return stats;
  } catch (error) {
    console.error("Scheduler error:", error);
    throw error;
  }
}

/**
 * Process a single queue item
 */
async function processQueueItem(
  item: QueueItem & { _docRef: FirebaseFirestore.DocumentReference },
  config: SchedulerConfig
): Promise<{ status: string }> {
  const docRef = item._docRef;

  // Mark as processing
  await docRef.update({
    status: "processing",
    processedAt: new Date().toISOString(),
  });

  try {
    // Get user's auto-apply config
    const configDoc = await adminDb
      .collection(`users/${item.userId}/settings`)
      .doc("auto-apply")
      .get();

    const autoApplyConfig = configDoc.data() as AutoApplyConfig | undefined;
    if (!autoApplyConfig?.enabled) {
      // Auto-apply disabled, skip
      await docRef.update({ status: "skipped" });
      return { status: "skipped" };
    }

    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    const todaySubmissions = await adminDb
      .collection(`users/${item.userId}/auto-apply-queue`)
      .where("status", "==", "submitted")
      .where("completedAt", ">=", `${today}T00:00:00Z`)
      .get();

    if (todaySubmissions.size >= config.dailyApplicationLimit) {
      console.log(
        `Daily limit reached for user ${item.userId} (${todaySubmissions.size}/${config.dailyApplicationLimit})`
      );
      return { status: "pending" }; // Will retry tomorrow
    }

    // TODO: Implement actual application logic here
    // 1. Check site reachability
    // 2. Detect form structure
    // 3. Prepare autofill data
    // 4. Attempt autofill via extension
    // 5. Handle manual actions or submit
    // 6. Create job application record
    // 7. Update queue item status

    // For now, mark as successful (placeholder)
    const jobApplicationId = `job_${Date.now()}`;
    await docRef.update({
      status: "submitted",
      completedAt: new Date().toISOString(),
      applicationResult: {
        success: true,
        submittedUrl: item.jobUrl,
        timestamp: new Date().toISOString(),
        jobApplicationId,
      },
    });

    // Log analytics event
    await logSchedulerEvent(item.userId, {
      eventType: "auto_apply_submitted",
      queueItemId: item.id,
      company: item.company,
      jobTitle: item.jobTitle,
    });

    return { status: "submitted" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Determine if retryable
    const retryable = !errorMsg.includes("site not found") && !errorMsg.includes("no form detected");

    if (shouldRetry(item) && retryable) {
      // Schedule retry
      const waitMinutes = Math.pow(2, item.retryCount);
      const nextRetryAt = new Date(Date.now() + waitMinutes * 60 * 1000).toISOString();

      await docRef.update({
        status: "failed",
        error: {
          message: errorMsg,
          timestamp: new Date().toISOString(),
        },
        lastRetryAt: new Date().toISOString(),
        nextRetryAt,
        retryCount: item.retryCount + 1,
      });

      return { status: "failed" };
    } else {
      // Give up, mark as permanently failed
      await docRef.update({
        status: "failed",
        error: {
          message: errorMsg,
          code: "max_retries_exceeded",
          timestamp: new Date().toISOString(),
        },
      });

      return { status: "failed" };
    }
  }
}

/**
 * Log scheduler events for analytics
 */
async function logSchedulerEvent(
  userId: string,
  event: { eventType: string } & Record<string, unknown>
): Promise<void> {
  const dateKey = new Date().toISOString().split("T")[0];

  const ref = adminDb
    .collection(`users/${userId}/analytics`)
    .doc(`auto-apply-${dateKey}`);

  await ref.set(
    {
      events: {
        [event.eventType]: FieldValue.arrayUnion(event),
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * HTTP endpoint to trigger scheduler (for Cloud Functions or Cloud Run)
 */
export async function handleSchedulerTrigger(request: Request): Promise<Response> {
  // Verify request is from authorized source (Cloud Scheduler, etc)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const config = DEFAULT_SCHEDULER_CONFIG;
    const stats = await runScheduler(config);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
