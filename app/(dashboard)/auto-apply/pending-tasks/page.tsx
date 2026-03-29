"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, ExternalLink } from "lucide-react";

interface ManualTask {
  id: string;
  jobId: string;
  queueId: string;
  jobTitle: string;
  company: string;
  taskType: string;
  description: string;
  instructions: string;
  applicationUrl: string;
  createdAt: string;
  expiresAt: string;
  completed: boolean;
  completedAt?: string;
}

const TASK_ICONS = {
  captcha: "🔐",
  file_upload: "📄",
  mfa: "🔑",
  phone_verification: "📱",
  email_verification: "✉️",
  custom_question: "❓",
  form_review: "📋",
  payment_info: "💳",
};

export default function PendingTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  const [submittingTask, setSubmittingTask] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const db = getFirestore();
      const q = query(
        collection(db, `users/${user.uid}/manual-tasks`),
        where("completed", "==", false)
      );
      const querySnapshot = await getDocs(q);

      const fetchedTasks = querySnapshot.docs
        .map((doc) => doc.data() as ManualTask)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .filter((task) => new Date(task.expiresAt) > new Date());

      setTasks(fetchedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchTasks();
    }
  }, [fetchTasks, user?.uid]);

  const handleTaskComplete = async (taskId: string, queueId: string, submitted: boolean) => {
    if (!user?.uid) return;

    setSubmittingTask(taskId);

    try {
      const response = await fetch("/api/auto-apply/task/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          taskId,
          queueId,
          submitted,
        }),
      });

      if (response.ok) {
        setCompletedTaskId(taskId);
        setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));

        // Reset after animation
        setTimeout(() => setCompletedTaskId(null), 2000);
      }
    } catch (error) {
      console.error("Error completing task:", error);
    } finally {
      setSubmittingTask(null);
    }
  };

  const groupedTasks = Object.groupBy(tasks, (task) => task.taskType) as Record<
    string,
    ManualTask[]
  >;

  const completionRate =
    tasks.length > 0
      ? Math.round(
          ((Object.keys(groupedTasks).reduce((sum, key) => {
            return sum + (groupedTasks[key]?.filter((t) => t.completed).length || 0);
          }, 0) / tasks.length) * 100)
        )
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Pending Tasks</h1>
        <p className="text-gray-600">
          Complete these tasks to finish your job applications
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Urgent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {
                tasks.filter(
                  (t) =>
                    new Date(t.expiresAt).getTime() - Date.now() <
                    24 * 60 * 60 * 1000
                ).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-600 mb-4">No pending tasks</p>
            <p className="text-sm text-gray-500">
              When you enable auto-apply, any applications requiring manual
              input will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTasks).map(([taskType, tasksOfType]) => (
            <div key={taskType} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                {TASK_ICONS[taskType as keyof typeof TASK_ICONS]} {taskType.replace(/_/g, " ")}
              </h2>
              <div className="space-y-3">
                {tasksOfType.map((task) => (
                  <Card
                    key={task.id}
                    className={`transition-all ${
                      completedTaskId === task.id
                        ? "ring-2 ring-green-500 opacity-50"
                        : ""
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {task.jobTitle}
                            </h3>
                            <Badge variant="outline">{task.company}</Badge>
                          </div>

                          <p className="text-sm text-gray-600">
                            {task.description}
                          </p>

                          <div className="text-sm text-gray-500 bg-gray-50 rounded p-3 mt-2">
                            {task.instructions}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Created{" "}
                              {new Date(task.createdAt).toLocaleDateString()}
                            </div>
                            <div>
                              Expires{" "}
                              {new Date(task.expiresAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <a
                            href={task.applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Go to Job <ExternalLink className="w-4 h-4" />
                          </a>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleTaskComplete(task.id, task.queueId, false)
                            }
                            disabled={submittingTask === task.id}
                          >
                            {submittingTask === task.id
                              ? "Saving..."
                              : "Need More Time"}
                          </Button>

                          <Button
                            size="sm"
                            onClick={() =>
                              handleTaskComplete(task.id, task.queueId, true)
                            }
                            disabled={submittingTask === task.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {submittingTask === task.id
                              ? "Saving..."
                              : "Task Complete"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            How to Complete Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>CAPTCHA:</strong> Visit the job link and solve the security
            challenge on the same tab. If you started assisted autofill with the
            extension, it can resume once the challenge is cleared.
          </p>
          <p>
            <strong>File Upload:</strong> Go to the job page and upload your
            resume/documents when prompted
          </p>
          <p>
            <strong>MFA/2FA:</strong> Enter the code sent to your email or phone
            to verify your login. The extension can continue after the check is
            cleared on the same tab.
          </p>
          <p>
            <strong>Form Review:</strong> Review the pre-filled form, make any
            corrections, then submit. Only click &quot;Task Complete&quot; after the
            employer site confirms the application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
