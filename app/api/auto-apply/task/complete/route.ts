import { NextRequest, NextResponse } from "next/server";
import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { JobApplication } from "@/lib/types";

export const runtime = "nodejs";

interface CompleteTaskRequest {
  taskId: string;
  queueId: string;
  submitted: boolean;
  notes?: string;
}

function handleError(error: unknown, scope: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(scope, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * POST /api/auto-apply/task/complete
 * Mark a manual task as completed and update queue status
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    const {
      taskId,
      queueId,
      submitted,
      notes = "",
    } = (await request.json()) as CompleteTaskRequest;

    if (!taskId || !queueId) {
      return NextResponse.json(
        { error: "Missing taskId or queueId" },
        { status: 400 }
      );
    }

    // Update task status
    const taskRef = adminDb.collection(`users/${uid}/manual-tasks`).doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskDoc.data();
    if (!task) {
      return NextResponse.json(
        { error: "Task data is missing" },
        { status: 500 }
      );
    }

    // Update task
    await taskRef.update({
      completed: true,
      completedAt: new Date().toISOString(),
      userNotes: notes,
    });

    // Get queue item
    const queueRef = adminDb
      .collection(`users/${uid}/auto-apply-queue`)
      .doc(queueId);
    const queueDoc = await queueRef.get();

    if (!queueDoc.exists) {
      return NextResponse.json(
        { error: "Queue item not found" },
        { status: 404 }
      );
    }

    const queueItem = queueDoc.data();
    if (!queueItem) {
      return NextResponse.json(
        { error: "Queue item data is missing" },
        { status: 500 }
      );
    }

    // If user submitted the application, create job application record
    if (submitted) {
      // Get job details from queue item
      const jobId = queueItem.jobId;
      const resolvedJobId = jobId || `auto_${Date.now()}`;
      const now = new Date().toISOString();

      // Create job application record
      const jobAppRef = adminDb
        .collection(`users/${uid}/jobs`)
        .doc(resolvedJobId);

      await jobAppRef.set(
        {
          id: resolvedJobId,
          title: queueItem.jobTitle || "Unknown",
          company: queueItem.company || "Unknown",
          location: queueItem.jobLocation || "Unknown",
          jobUrl: queueItem.jobUrl,
          appliedDate: now,
          status: "applied",
          source: "auto-apply",
          createdAt: now,
          updatedAt: now,
          autoApplied: {
            recommendationId: queueItem.recommendationId || "",
            submittedAt: now,
            queueId: queueId,
            method: "auto_fill_manual_submit",
            filledForms: [task.taskType],
          },
          notes,
          feedback: {
            outcome: "applied",
            recordedAt: now,
            userNotes: notes,
          },
        } as JobApplication,
        { merge: true }
      );

      // Update queue item to submitted
      await queueRef.update({
        status: "submitted",
        completedAt: Timestamp.now(),
        applicationResult: {
          success: true,
          submittedUrl: queueItem.jobUrl,
          timestamp: now,
          jobApplicationId: resolvedJobId,
        },
      });

      // Log analytics event
      await logSchedulerEvent(uid, {
        eventType: "manual_task_completed_submitted",
        queueItemId: queueId,
        taskId,
        company: queueItem.company,
        jobTitle: queueItem.jobTitle,
        taskType: task.taskType,
      });

      return NextResponse.json(
        {
          success: true,
          status: "submitted",
          message: "Application submitted successfully",
          jobApplicationId: resolvedJobId,
        },
        { status: 200 }
      );
    } else {
      // User completed task but didn't submit (e.g., needs more time)
      await queueRef.update({
        status: "pending",
        completedAt: Timestamp.now(),
      });

      // Log analytics event
      await logSchedulerEvent(uid, {
        eventType: "manual_task_completed_not_submitted",
        queueItemId: queueId,
        taskId,
        company: queueItem.company,
        jobTitle: queueItem.jobTitle,
        taskType: task.taskType,
      });

      return NextResponse.json(
        {
          success: true,
          status: "pending",
          message: "Task marked complete, application not submitted yet",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    return handleError(error, "Error completing task:");
  }
}

/**
 * GET /api/auto-apply/task/[taskId]
 * Get task details
 */
export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyIdToken(request);

    const taskId = request.nextUrl.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId parameter" },
        { status: 400 }
      );
    }

    const taskDoc = await adminDb
      .collection(`users/${uid}/manual-tasks`)
      .doc(taskId)
      .get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        task: taskDoc.data(),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error, "Error getting task:");
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
