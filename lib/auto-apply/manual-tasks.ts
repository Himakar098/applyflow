/**
 * Auto-Apply Manual Task System
 * Manages tasks that require user interaction (CAPTCHAs, MFA, file uploads, etc)
 */

export type ManualTaskType =
  | "captcha"
  | "file_upload"
  | "mfa"
  | "phone_verification"
  | "email_verification"
  | "custom_question"
  | "form_review"
  | "payment_info";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "expired";

export interface ManualTask {
  id: string;
  userId: string;
  jobId: string;
  queueId: string; // Reference to auto-apply queue item

  // Task metadata
  taskType: ManualTaskType;
  title: string;
  description: string;
  instructions?: string;

  // Job context
  jobTitle: string;
  company: string;
  applicationUrl: string;

  // Status tracking
  status: TaskStatus;
  createdAt: string;
  expiresAt?: string; // Task expires after 24-48 hours
  startedAt?: string;
  completedAt?: string;

  // User notification
  notified: boolean;
  notificationSentAt?: string;

  // Retry logic
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: string;

  // Auto-completion
  autoSubmitAfterCompletion: boolean; // If true, auto-submit the form when user marks as complete
}

export interface ManualTaskInput {
  jobId: string;
  queueId: string;
  taskType: ManualTaskType;
  title: string;
  description: string;
  jobTitle: string;
  company: string;
  applicationUrl: string;
  instructions?: string;
  autoSubmitAfterCompletion?: boolean;
  maxRetries?: number;
}

/**
 * Creates a new manual task
 */
export function createManualTask(
  userId: string,
  taskInput: ManualTaskInput,
  taskId?: string
): ManualTask {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  return {
    id: taskId || crypto.randomUUID?.() || Math.random().toString(36).slice(2, 11),
    userId,
    jobId: taskInput.jobId,
    queueId: taskInput.queueId,
    taskType: taskInput.taskType,
    title: taskInput.title,
    description: taskInput.description,
    instructions: taskInput.instructions,
    jobTitle: taskInput.jobTitle,
    company: taskInput.company,
    applicationUrl: taskInput.applicationUrl,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    notified: false,
    retryCount: 0,
    maxRetries: taskInput.maxRetries || 3,
    autoSubmitAfterCompletion: taskInput.autoSubmitAfterCompletion ?? true,
  };
}

/**
 * Default instructions for different task types
 */
export const TASK_INSTRUCTIONS: Record<ManualTaskType, string> = {
  captcha:
    "Please solve the CAPTCHA puzzle on the application form. Once you've solved it, click the 'I completed this task' button to continue.",
  file_upload:
    "Please upload your resume or required documents. Select the file from your computer and upload it to the form.",
  mfa: "A multi-factor authentication (MFA) code has been sent to your registered phone/email. Please enter the code to complete the verification.",
  phone_verification:
    "The company is requesting phone verification. Please answer the verification call or enter the code sent to your phone.",
  email_verification:
    "Check your email for a verification link. Click the link to verify your email address and continue with the application.",
  custom_question:
    "The company is asking a custom question that requires your input. Please answer the question thoughtfully and naturally.",
  form_review:
    "The form couldn't be automatically filled. Please review the form, fill in any missing fields manually, and submit the application.",
  payment_info:
    "The application requires payment or billing information. This might be an application fee or premium job posting. Please provide the requested information to continue.",
};

/**
 * Determines if a task should still be active
 */
export function isTaskActive(task: ManualTask): boolean {
  if (task.status === "completed" || task.status === "skipped") {
    return false;
  }

  if (task.expiresAt) {
    return new Date(task.expiresAt) > new Date();
  }

  return true;
}

/**
 * Calculates task completion rate for a user
 */
export function calculateTaskCompletionRate(
  tasks: ManualTask[]
): {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  averageCompletionTimeMinutes: number;
} {
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const totalTasks = tasks.filter((t) => isTaskActive(t)).length;
  const pendingTasks = tasks.filter(
    (t) => isTaskActive(t) && t.status === "pending"
  ).length;

  let totalCompletionTimeMinutes = 0;
  let completedCount = 0;

  for (const task of completedTasks) {
    if (task.createdAt && task.completedAt) {
      const createdTime = new Date(task.createdAt).getTime();
      const completedTime = new Date(task.completedAt).getTime();
      const durationMinutes = (completedTime - createdTime) / (1000 * 60);
      totalCompletionTimeMinutes += durationMinutes;
      completedCount++;
    }
  }

  const averageCompletionTimeMinutes =
    completedCount > 0 ? totalCompletionTimeMinutes / completedCount : 0;

  return {
    totalTasks: totalTasks + completedTasks.length,
    completedTasks: completedTasks.length,
    pendingTasks,
    completionRate:
      completedCount > 0
        ? (completedTasks.length / (totalTasks + completedTasks.length)) * 100
        : 0,
    averageCompletionTimeMinutes: Math.round(averageCompletionTimeMinutes),
  };
}

/**
 * Groups tasks by type
 */
export function groupTasksByType(
  tasks: ManualTask[]
): Record<ManualTaskType, ManualTask[]> {
  const grouped: Record<ManualTaskType, ManualTask[]> = {
    captcha: [],
    file_upload: [],
    mfa: [],
    phone_verification: [],
    email_verification: [],
    custom_question: [],
    form_review: [],
    payment_info: [],
  };

  for (const task of tasks) {
    grouped[task.taskType].push(task);
  }

  return grouped;
}

/**
 * Generates a summary of pending tasks
 */
export function generateTaskSummary(
  tasks: ManualTask[]
): {
  summary: string;
  taskCount: Record<ManualTaskType, number>;
} {
  const pendingtasks = tasks.filter((t) => isTaskActive(t) && t.status === "pending");
  const grouped = groupTasksByType(pendingtasks);

  const taskCount: Record<ManualTaskType, number> = {
    captcha: grouped.captcha.length,
    file_upload: grouped.file_upload.length,
    mfa: grouped.mfa.length,
    phone_verification: grouped.phone_verification.length,
    email_verification: grouped.email_verification.length,
    custom_question: grouped.custom_question.length,
    form_review: grouped.form_review.length,
    payment_info: grouped.payment_info.length,
  };

  const totalTasks = pendingtasks.length;

  if (totalTasks === 0) {
    return {
      summary: "No pending tasks",
      taskCount,
    };
  }

  const taskParts: string[] = [];
  if (grouped.captcha.length > 0) {
    taskParts.push(`${grouped.captcha.length} CAPTCHA`);
  }
  if (grouped.file_upload.length > 0) {
    taskParts.push(`${grouped.file_upload.length} file upload`);
  }
  if (grouped.mfa.length > 0) {
    taskParts.push(`${grouped.mfa.length} MFA verification`);
  }
  if (grouped.custom_question.length > 0) {
    taskParts.push(`${grouped.custom_question.length} custom question`);
  }

  const summary =
    totalTasks === 1
      ? `1 pending task: ${taskParts[0]}`
      : `${totalTasks} pending tasks: ${taskParts.join(", ")}`;

  return {
    summary,
    taskCount,
  };
}
