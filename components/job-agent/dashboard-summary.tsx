"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Gauge,
  MessageSquareMore,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  jobAgentRequest,
  unwrapList,
  type JobAgentApplication,
  type JobAgentJob,
} from "@/lib/job-agent/client";

export function JobAgentDashboardSummary() {
  const [jobs, setJobs] = useState<JobAgentJob[]>([]);
  const [applications, setApplications] = useState<JobAgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      jobAgentRequest<unknown>("/api/job-agent/jobs?limit=100"),
      jobAgentRequest<unknown>("/api/job-agent/applications?limit=100"),
    ])
      .then(([jobPayload, applicationPayload]) => {
        if (!active) return;
        setJobs(unwrapList<JobAgentJob>(jobPayload, ["jobs"]));
        setApplications(
          unwrapList<JobAgentApplication>(applicationPayload, ["applications"]),
        );
      })
      .catch(() => {
        if (active) setAvailable(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const fortnight = new Date(now);
    fortnight.setDate(now.getDate() + 14);
    return [
      {
        label: "High-fit jobs",
        value: jobs.filter((job) => (job.fitScore ?? 0) >= 75).length,
        icon: Gauge,
      },
      {
        label: "Ready for review",
        value: applications.filter((item) =>
          ["READY_FOR_REVIEW", "READY_TO_SUBMIT"].includes(item.status),
        ).length,
        icon: FileCheck2,
      },
      {
        label: "Submitted this week",
        value: applications.filter((item) =>
          item.status === "SUBMITTED"
          && Boolean(item.dateApplied)
          && new Date(item.dateApplied ?? "") >= weekAgo,
        ).length,
        icon: CheckCircle2,
      },
      {
        label: "Closing soon",
        value: jobs.filter((job) => {
          if (!job.closingDate) return false;
          const date = new Date(job.closingDate);
          return date >= now && date <= fortnight;
        }).length,
        icon: CalendarClock,
      },
      {
        label: "Follow-ups due",
        value: applications.filter((item) =>
          Boolean(item.followUpDate)
          && new Date(item.followUpDate ?? "") <= now,
        ).length,
        icon: MessageSquareMore,
      },
      {
        label: "Interviews",
        value: applications.filter((item) =>
          ["SCREENING", "INTERVIEW", "TECHNICAL_ASSESSMENT", "FINAL_INTERVIEW"].includes(item.status),
        ).length,
        icon: UsersRound,
      },
      {
        label: "Eligibility warnings",
        value: jobs.filter((job) =>
          ["needs_review", "ineligible"].includes(job.eligibility ?? ""),
        ).length,
        icon: AlertTriangle,
      },
    ];
  }, [applications, jobs]);

  if (!available) return null;

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Supervised Job Agent</CardTitle>
          <CardDescription>
            Eligibility, preparation, approvals, and follow-ups at a glance.
          </CardDescription>
        </div>
        <Button asChild variant="outline">
          <Link href="/job-agent">Open Job Agent</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {loading
          ? Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))
          : cards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs leading-4 text-muted-foreground">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
