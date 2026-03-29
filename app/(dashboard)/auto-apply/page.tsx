"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  submitted: number;
  failed: number;
  manualActionNeeded: number;
  successRate: number;
  averageProcessingTime: number;
}

interface DailyStats {
  date: string;
  submitted: number;
  failed: number;
  manual: number;
}

export default function AutoApplyDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    submitted: 0,
    failed: 0,
    manualActionNeeded: 0,
    successRate: 0,
    averageProcessingTime: 0,
  });
  const [enabled, setEnabled] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      // Get queue stats via API
      const response = await fetch("/api/auto-apply/process", {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }

      // Get auto-apply config from client-side Firestore
      const db = getFirestore();
      const settingsRef = collection(db, `users/${user.uid}/settings`);
      const settingsDocs = await getDocs(settingsRef);

      const configDoc = settingsDocs.docs.find(doc => doc.id === "auto-apply");
      const config = configDoc?.data();
      setEnabled(config?.enabled || false);

      // Get last 7 days stats from client-side Firestore
      const analyticsRef = collection(db, `users/${user.uid}/analytics`);
      const analyticsDocs = await getDocs(analyticsRef);

      const stats: Record<string, DailyStats> = {};
      analyticsDocs.docs.forEach((doc) => {
        const data = doc.data();
        const dateKey = doc.id.replace("auto-apply-", "");

        if (!stats[dateKey]) {
          stats[dateKey] = { date: dateKey, submitted: 0, failed: 0, manual: 0 };
        }

        if (data.events?.auto_apply_submitted) {
          stats[dateKey].submitted += data.events.auto_apply_submitted.length;
        }
        if (data.events?.auto_apply_failed) {
          stats[dateKey].failed += data.events.auto_apply_failed.length;
        }
        if (data.events?.manual_task_created) {
          stats[dateKey].manual += data.events.manual_task_created.length;
        }
      });

      const dailyData = Object.values(stats).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setDailyStats(dailyData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [fetchDashboardData, user?.uid]);

  const successPercentage = stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0;
  const failurePercentage = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
  const manualPercentage = stats.total > 0 ? (stats.manualActionNeeded / stats.total) * 100 : 0;

  const chartData = [
    { name: "Submitted", value: Math.round(successPercentage), fill: "#10b981" },
    { name: "Failed", value: Math.round(failurePercentage), fill: "#ef4444" },
    { name: "Manual", value: Math.round(manualPercentage), fill: "#f59e0b" },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Auto-Apply Dashboard</h1>
          <p className="text-gray-600">
            Monitor your automatic job applications and pending tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/auto-apply/settings">
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Banner */}
      <Card
        className={`border-2 ${
          enabled
            ? "border-green-200 bg-green-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-semibold">Auto-Apply is Active</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="font-semibold text-gray-700">
                  Auto-Apply is Disabled
                </span>
              </>
            )}
          </div>
          {!enabled && (
            <Link href="/dashboard/auto-apply/settings">
              <Button size="sm">Enable Auto-Apply</Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Successfully Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(successPercentage)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.manualActionNeeded}
            </div>
            <p className="text-xs text-gray-500 mt-1">Require your attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              In Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-gray-500 mt-1">
              Check and retry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success Rate Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Status</CardTitle>
            <CardDescription>Breakdown of all applications</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No applications yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity (Last 7 Days)</CardTitle>
            <CardDescription>Daily application submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="submitted" stackId="a" fill="#10b981" name="Submitted" />
                  <Bar dataKey="manual" stackId="a" fill="#f59e0b" name="Manual" />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No activity yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Applications</CardTitle>
          <CardDescription>Your last 10 auto-applied jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Fetching recent applications...
          </div>
        </CardContent>
      </Card>

      {/* Tips & Insights */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm">Tips for Maximum Success</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Complete pending tasks within 48 hours to maximize response time</li>
            <li>
              Update your application outcomes (rejected, interview, offer) to improve future recommendations
            </li>
            <li>
              Adjust your auto-apply settings if you&apos;re getting too many unrelated jobs
            </li>
            <li>Check back regularly to complete CAPTCHA challenges and file uploads</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
