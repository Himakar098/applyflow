"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { StatusPill } from "@/components/job-agent/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type JobAgentJob,
  extractedText,
  jobAgentRequest,
  unwrapList,
} from "@/lib/job-agent/client";

export function JobAgentJobsPanel() {
  const [jobs, setJobs] = useState<JobAgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jobAgentRequest<unknown>("/api/job-agent/jobs?limit=20")
      .then((payload) => {
        if (active) setJobs(unwrapList<JobAgentJob>(payload, ["jobs"]));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load assessed jobs");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Job Agent assessments</CardTitle>
          <CardDescription>
            Imported roles with deterministic eligibility and transparent fit scores.
          </CardDescription>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="mr-2 h-4 w-4" /> Import job
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </p>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="font-medium">No assessed jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Import a description to check work-right eligibility before deciding to apply.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-white/70">
            {jobs.map((job) => {
              const eligibility = job.eligibility ?? job.assessment?.eligibility?.decision ?? job.assessment?.eligibility?.status;
              const score = job.fitScore ?? job.assessment?.fit?.score;
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{extractedText(job.title, "Untitled role")}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {extractedText(job.company, "Unknown company")} {job.location ? `· ${extractedText(job.location)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={eligibility} />
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                      {typeof score === "number" ? `${score}/100` : "Not scored"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
