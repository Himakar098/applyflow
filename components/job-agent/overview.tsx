"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Gauge,
  MessageSquareMore,
  ShieldCheck,
} from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type JobAgentApplication,
  type JobAgentJob,
  type JobAgentProfile,
  jobAgentRequest,
  unwrapList,
  unwrapRecord,
} from "@/lib/job-agent/client";

type DashboardState = {
  profile: JobAgentProfile | null;
  jobs: JobAgentJob[];
  applications: JobAgentApplication[];
};

export function JobAgentOverview() {
  const [state, setState] = useState<DashboardState>({
    profile: null,
    jobs: [],
    applications: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [profilePayload, jobsPayload, applicationsPayload] = await Promise.all([
          jobAgentRequest<unknown>("/api/job-agent/profile"),
          jobAgentRequest<unknown>("/api/job-agent/jobs?limit=100"),
          jobAgentRequest<unknown>("/api/job-agent/applications?limit=100"),
        ]);
        if (!active) return;
        const profileEnvelope = profilePayload as {
          profile?: JobAgentProfile;
          completeness?: number;
          display?: { workRights?: JobAgentProfile["workRights"] };
        };
        const loadedProfile = unwrapRecord<JobAgentProfile>(profilePayload, ["profile"]);
        setState({
          profile: loadedProfile
            ? {
                ...loadedProfile,
                completeness: profileEnvelope.completeness,
                workRights: {
                  ...loadedProfile.workRights,
                  ...profileEnvelope.display?.workRights,
                },
              }
            : null,
          jobs: unwrapList<JobAgentJob>(jobsPayload, ["jobs"]),
          applications: unwrapList<JobAgentApplication>(applicationsPayload, ["applications"]),
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load Job Agent");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
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
    const highFit = state.jobs.filter((job) => (job.fitScore ?? job.assessment?.fit?.score ?? 0) >= 75).length;
    const ready = state.applications.filter((item) =>
      ["READY_FOR_REVIEW", "READY_TO_SUBMIT", "SUBMISSION_APPROVED"].includes(item.status),
    ).length;
    const submitted = state.applications.filter((item) => {
      if (item.status !== "SUBMITTED" || !item.dateApplied) return false;
      return new Date(item.dateApplied) >= weekAgo;
    }).length;
    const closing = state.jobs.filter((job) => {
      const value = typeof job.closingDate === "string" ? job.closingDate : undefined;
      if (!value) return false;
      const date = new Date(value);
      return date >= now && date <= fortnight;
    }).length;
    const followUps = state.applications.filter((item) => {
      if (!item.followUpDate) return false;
      return new Date(item.followUpDate) <= now;
    }).length;
    const interviews = state.applications.filter((item) =>
      ["SCREENING", "INTERVIEW", "TECHNICAL_ASSESSMENT", "FINAL_INTERVIEW"].includes(item.status),
    ).length;
    const warnings = state.jobs.filter((job) =>
      ["NEEDS_REVIEW", "INELIGIBLE"].includes(
        (job.eligibility ?? job.assessment?.eligibility?.decision ?? job.assessment?.eligibility?.status ?? "").toUpperCase(),
      ),
    ).length;
    return [
      { label: "High-fit jobs", value: highFit, icon: Gauge, href: "/jobs?fit=high" },
      { label: "Ready for review", value: ready, icon: FileCheck2, href: "/applications" },
      { label: "Submitted this week", value: submitted, icon: CheckCircle2, href: "/applications" },
      { label: "Closing soon", value: closing, icon: CalendarClock, href: "/jobs" },
      { label: "Follow-ups due", value: followUps, icon: MessageSquareMore, href: "/applications" },
      { label: "Interviews", value: interviews, icon: ShieldCheck, href: "/applications" },
      { label: "Eligibility warnings", value: warnings, icon: AlertTriangle, href: "/jobs" },
    ];
  }, [state]);

  const completeness = Math.min(
    100,
    Math.max(0, Number(state.profile?.completeness ?? (state.profile ? 100 : 0))),
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Supervised job agent"
        title="Prepare stronger applications without giving up control."
        description="Import roles, run deterministic eligibility checks, generate grounded documents, and use a visible browser assistant. Final submission always requires a separate approval for that application."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/profile">Review profile</Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/new">Import a job</Link>
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-950">Job Agent needs attention</CardTitle>
            <CardDescription className="text-amber-800">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))
          : cards.map(({ label, value, icon: Icon, href }) => (
              <Link key={label} href={href} className="group">
                <Card className="surface-card h-full transition-transform group-hover:-translate-y-0.5">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-1 text-3xl font-semibold">{value}</p>
                    </div>
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,1.35fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Truthful profile</CardTitle>
            <CardDescription>
              Claim statuses and work-right answers are the grounding source for every application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Profile completeness</span>
              <span className="font-semibold">{completeness}%</span>
            </div>
            <Progress value={completeness} />
            <div className="flex flex-wrap gap-2">
              <StatusPill
                value={state.profile?.workRights?.fullAustralianWorkRights ? "verified" : "needs-confirmation"}
              />
              <StatusPill value="review_before_submit" />
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/profile">Check claims and private details</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Supervised application path</CardTitle>
            <CardDescription>The automation boundary is explicit at every side effect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["1", "Import and assess", "Extraction, eligibility, and transparent fit scoring."],
              ["2", "Review documents and answers", "Only grounded evidence is used; uncertain answers are flagged."],
              ["3", "Approve autofill", "You start a visible browser and approve the proposed field plan."],
              ["4", "Approve submission separately", "The worker stops before Submit until a single-use approval exists."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-3 rounded-xl border bg-white/70 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {number}
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
            <Button asChild variant="ghost" className="w-full">
              <Link href="/applications">
                Open applications <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
