/**
 * Auto-Apply Queue Management System
 * Handles job application queuing, status tracking, and retry logic
 */

export type QueueItemStatus = "pending" | "processing" | "submitted" | "failed" | "manual_action_needed" | "skipped";

export interface QueueItem {
  id: string;
  userId: string;
  recommendationId?: string;
  jobId?: string;

  // Job metadata
  jobTitle: string;
  company: string;
  jobUrl: string;
  applicationUrl?: string;
  jobDescription?: string;

  // Processing status
  status: QueueItemStatus;
  priority: number; // 0-100, higher = more urgent
  addedAt: string;
  processedAt?: string;
  completedAt?: string;

  // Error tracking
  error?: {
    message: string;
    code?: string;
    timestamp: string;
  };

  // Retry logic
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  lastRetryAt?: string;

  // Application result
  applicationResult?: {
    success: boolean;
    submittedUrl?: string;
    timestamp: string;
    jobApplicationId?: string; // Reference to created job application
  };

  // Manual tasks
  manualTasks?: string[]; // Task IDs that need user action

  // Configuration used
  configSnapshot?: {
    autoSubmit: boolean;
    attachResume: boolean;
  };
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  submitted: number;
  failed: number;
  manualActionNeeded: number;
  successRate: number;
  averageProcessingTimeSeconds: number;
  oldestPendingItem?: {
    id: string;
    addedAt: string;
    ageMinutes: number;
  };
}

/**
 * Creates a new queue item
 */
export function createQueueItem(
  userId: string,
  jobData: {
    recommendationId?: string;
    jobId?: string;
    jobTitle: string;
    company: string;
    jobUrl: string;
    jobDescription?: string;
  },
  priority: number = 50,
  maxRetries: number = 3
): QueueItem {
  const now = new Date();

  return {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    recommendationId: jobData.recommendationId,
    jobId: jobData.jobId,
    jobTitle: jobData.jobTitle,
    company: jobData.company,
    jobUrl: jobData.jobUrl,
    jobDescription: jobData.jobDescription,
    status: "pending",
    priority: Math.max(0, Math.min(100, priority)),
    addedAt: now.toISOString(),
    retryCount: 0,
    maxRetries,
  };
}

/**
 * Sorts queue items by priority and age
 */
export function sortQueueItems(items: QueueItem[]): QueueItem[] {
  return items.sort((a, b) => {
    // pending items first
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;

    // Within pending, sort by priority (higher first)
    if (a.status === "pending" && b.status === "pending") {
      if (a.priority !== b.priority) {
        return (b.priority || 0) - (a.priority || 0);
      }
      // Then by age (older first)
      return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
    }

    // processing items next
    if (a.status === "processing" && b.status !== "processing") return -1;
    if (b.status === "processing" && a.status !== "processing") return 1;

    // For other statuses, order by most recent
    return new Date(b.processedAt || b.addedAt).getTime() - new Date(a.processedAt || a.addedAt).getTime();
  });
}

/**
 * Calculates queue statistics
 */
export function calculateQueueStats(items: QueueItem[]): QueueStats {
  const stats: QueueStats = {
    total: items.length,
    pending: 0,
    processing: 0,
    submitted: 0,
    failed: 0,
    manualActionNeeded: 0,
    successRate: 0,
    averageProcessingTimeSeconds: 0,
  };

  let totalProcessingTime = 0;
  for (const item of items) {
    switch (item.status) {
      case "pending":
        stats.pending++;
        break;
      case "processing":
        stats.processing++;
        break;
      case "submitted":
        stats.submitted++;
        break;
      case "failed":
        stats.failed++;
        break;
      case "manual_action_needed":
        stats.manualActionNeeded++;
        break;
    }

    // Calculate average processing time
    if (item.processedAt && item.status !== "pending") {
      const processingTime =
        (new Date(item.processedAt).getTime() - new Date(item.addedAt).getTime()) / 1000;
      totalProcessingTime += processingTime;
    }
  }

  // Calculate success rate
  const completedItems = items.filter((i) => i.status === "submitted" || i.status === "failed");
  if (completedItems.length > 0) {
    const successful = items.filter((i) => i.status === "submitted" && i.applicationResult?.success);
    stats.successRate = (successful.length / completedItems.length) * 100;
  }

  // Calculate average processing time
  const itemsWithProcessTime = items.filter((i) => i.processedAt);
  if (itemsWithProcessTime.length > 0) {
    stats.averageProcessingTimeSeconds = Math.round(
      totalProcessingTime / itemsWithProcessTime.length
    );
  }

  // Find oldest pending item
  const pendingItems = items.filter((i) => i.status === "pending");
  if (pendingItems.length > 0) {
    const oldest = pendingItems.reduce((prev, current) =>
      new Date(prev.addedAt) < new Date(current.addedAt) ? prev : current
    );
    const ageMinutes = Math.floor(
      (Date.now() - new Date(oldest.addedAt).getTime()) / (1000 * 60)
    );
    stats.oldestPendingItem = {
      id: oldest.id,
      addedAt: oldest.addedAt,
      ageMinutes,
    };
  }

  return stats;
}

/**
 * Checks if an item should be retried
 */
export function shouldRetry(item: QueueItem, maxWaitMinutes: number = 60): boolean {
  if (item.status !== "failed") return false;
  if (item.retryCount >= item.maxRetries) return false;

  if (!item.lastRetryAt) {
    return true; // First retry
  }

  // Exponential backoff: wait 2^retryCount minutes
  const waitMinutes = Math.pow(2, item.retryCount);
  const nextRetryTime = new Date(item.lastRetryAt).getTime() + waitMinutes * 60 * 1000;

  return Date.now() >= nextRetryTime && waitMinutes <= maxWaitMinutes;
}

/**
 * Filters queue items by criteria
 */
export function filterQueueItems(
  items: QueueItem[],
  criteria: {
    status?: QueueItemStatus[];
    userId?: string;
    company?: string;
    minPriority?: number;
    failedOnly?: boolean;
  }
): QueueItem[] {
  return items.filter((item) => {
    if (criteria.status && !criteria.status.includes(item.status)) return false;
    if (criteria.userId && item.userId !== criteria.userId) return false;
    if (criteria.company && item.company !== criteria.company) return false;
    if (criteria.minPriority !== undefined && (item.priority || 0) < criteria.minPriority) {
      return false;
    }
    if (criteria.failedOnly && item.status !== "failed") return false;
    return true;
  });
}

/**
 * Generates a summary of queue status
 */
export function generateQueueSummary(stats: QueueStats): string {
  const parts: string[] = [];

  if (stats.pending > 0) {
    parts.push(`${stats.pending} pending`);
  }
  if (stats.processing > 0) {
    parts.push(`${stats.processing} processing`);
  }
  if (stats.manualActionNeeded > 0) {
    parts.push(`${stats.manualActionNeeded} requiring action`);
  }
  if (stats.failed > 0) {
    parts.push(`${stats.failed} failed`);
  }

  if (parts.length === 0) {
    return "Queue is empty";
  }

  return `Queue: ${parts.join(", ")} (success rate: ${stats.successRate.toFixed(1)}%)`;
}
