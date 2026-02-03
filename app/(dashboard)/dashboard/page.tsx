"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { JobStats } from "@/components/jobs/job-stats";
import { StatusBadge } from "@/components/jobs/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchJobs as fetchJobsAction } from "@/app/actions/jobs";
import { fetchResumes as fetchResumesAction } from "@/app/actions/resumes";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchGamificationDaily } from "@/lib/gamification/client";
import type { JobApplication, ResumeRecord } from "@/lib/types";

export default function DashboardPage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyXp, setDailyXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [missionCounts, setMissionCounts] = useState({
    searchRuns: 0,
    jobsSaved: 0,
    recommendationsSaved: 0,
    applyChecklist: 0,
    profileSaved: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const idToken = token ?? (await refreshToken());
        if (!idToken) return;
        const [jobsData, resumeData, gamification] = await Promise.all([
          fetchJobsAction(idToken),
          fetchResumesAction(idToken),
          fetchGamificationDaily(),
        ]);
        setJobs(jobsData);
        setResumes(resumeData);
        if (gamification) {
          setDailyXp(gamification.daily.xp ?? 0);
          setStreak(gamification.meta.streak ?? 0);
          setMissionCounts({
            searchRuns: gamification.daily.events.searchRuns ?? 0,
            jobsSaved: gamification.daily.events.jobsSaved ?? 0,
            recommendationsSaved: gamification.daily.events.recommendationsSaved ?? 0,
            applyChecklist: gamification.daily.events.applyChecklist ?? 0,
            profileSaved: gamification.daily.events.profileSaved ?? 0,
          });
        }
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to load your workspace",
          description: "Check Firebase credentials and try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token, refreshToken, toast]);

  const latestResume = useMemo(() => {
    return [...resumes].sort((a, b) =>
      a.uploadedAt > b.uploadedAt ? -1 : 1,
    )[0];
  }, [resumes]);

  const toDate = (value?: string | { toDate?: () => Date } | null) => {
    if (!value) return null;
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }
    return null;
  };

  const weeklyReport = useMemo(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);
    const isInWeek = (date?: Date | null) => {
      if (!date) return false;
      return date >= start && date <= today;
    };

    const newRoles = jobs.filter((job) => isInWeek(toDate(job.createdAt))).length;
    const appliedThisWeek = jobs.filter((job) => isInWeek(toDate(job.appliedDate ?? ""))).length;
    const interviewsActive = jobs.filter((job) => job.status === "interview").length;
    const offersActive = jobs.filter((job) => job.status === "offer").length;
    const followUpsDue = jobs.filter((job) => {
      const date = toDate(job.followUpDate ?? "");
      return date && date >= today;
    }).length;

    const momentum = Math.min(
      100,
      newRoles * 10 + appliedThisWeek * 15 + interviewsActive * 20 + offersActive * 30,
    );

    return {
      newRoles,
      appliedThisWeek,
      interviewsActive,
      offersActive,
      followUpsDue,
      momentum,
    };
  }, [jobs]);

  const upcomingFollowUps = useMemo(() => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);
    return jobs
      .filter((job) => job.followUpDate)
      .map((job) => ({ ...job, followUpDate: job.followUpDate ?? "" }))
      .filter((job) => {
        const date = new Date(job.followUpDate);
        return date >= today && date <= end;
      })
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
      .slice(0, 3);
  }, [jobs]);

  const missionConfig = [
    { label: "Run a search", key: "searchRuns", cap: 3 },
    { label: "Save 1 job", key: "jobsSaved", cap: 3 },
    { label: "Save a recommendation", key: "recommendationsSaved", cap: 3 },
    { label: "Finish an apply checklist", key: "applyChecklist", cap: 2 },
    { label: "Save your profile", key: "profileSaved", cap: 1 },
  ] as const;

  return (
    <div className="space-y-6">
      <Card className="surface-panel hero-panel">
        <CardContent className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <Sparkles className="h-4 w-4" /> AI-ready application cockpit
            </div>
            <h2 className="text-2xl font-semibold text-foreground">
              Move faster with an ATS-safe workflow
            </h2>
            <p className="text-sm text-muted-foreground">
              Track applications, store resumes, and prepare AI-generated tailoring in one view.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                Protected routes
              </Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                Firebase Auth + Firestore
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/jobs">
                View tracker <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/resume">Upload resume</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <JobStats jobs={jobs} />
      )}

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Weekly progress report</CardTitle>
            <CardDescription>Your last 7 days of momentum.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="chip">Momentum score</span>
            <span className="font-semibold text-foreground">{weeklyReport.momentum}</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">New roles saved</p>
              <p className="text-2xl font-semibold text-foreground">{weeklyReport.newRoles}</p>
              <Progress value={Math.min(100, weeklyReport.newRoles * 20)} className="mt-2 h-1.5" />
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">Applied this week</p>
              <p className="text-2xl font-semibold text-foreground">{weeklyReport.appliedThisWeek}</p>
              <Progress value={Math.min(100, weeklyReport.appliedThisWeek * 25)} className="mt-2 h-1.5" />
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">Interviews active</p>
              <p className="text-2xl font-semibold text-foreground">{weeklyReport.interviewsActive}</p>
              <p className="text-xs text-muted-foreground">Keep preparing</p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">Offers active</p>
              <p className="text-2xl font-semibold text-foreground">{weeklyReport.offersActive}</p>
              <p className="text-xs text-muted-foreground">Celebrate progress</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Next best action</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You have <span className="font-semibold text-foreground">{weeklyReport.followUpsDue}</span> follow-ups due.
              Clear them to keep response rates high.
            </p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href="/jobs">Review follow-ups</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent applications</CardTitle>
              <CardDescription>Your most recent activity across sources.</CardDescription>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/jobs">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Add your first application to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between rounded-xl border px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold leading-tight text-foreground">
                        {job.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.company} • {job.source ?? "Manual"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={job.status} />
                      <p className="text-xs text-muted-foreground">
                        {job.appliedDate
                          ? new Date(job.appliedDate).toLocaleDateString()
                          : "No date"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Daily missions</CardTitle>
              <CardDescription>Complete these to keep your streak alive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Streak</span>
                <span className="font-semibold text-foreground">{streak} days</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">XP today</span>
                <span className="font-semibold text-foreground">{dailyXp}</span>
              </div>
              <div className="space-y-2">
                {missionConfig.map((mission) => {
                  const value = missionCounts[mission.key];
                  const done = Math.min(value, mission.cap);
                  return (
                    <div key={mission.key} className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{mission.label}</span>
                        <span className="font-semibold text-foreground">
                          {done}/{mission.cap}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (done / mission.cap) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Upcoming follow-ups</CardTitle>
              <CardDescription>Stay ahead of your pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : upcomingFollowUps.length ? (
                upcomingFollowUps.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-lg border border-white/60 bg-white/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.company}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.followUpDate || "").toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No follow-ups due in the next 7 days.</p>
              )}
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Latest resume</CardTitle>
              <CardDescription>Stored securely and ready for AI tailoring.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : latestResume ? (
                <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground" title={latestResume.fileName}>
                        {latestResume.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {new Date(latestResume.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {latestResume.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                    {latestResume.parsedText ||
                      "Resume parsed and ready for future AI optimization."}
                  </p>
                  <Button asChild className="mt-4 w-full" variant="outline">
                    <Link href="/resume">Manage resumes</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Upload a resume to preview it here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
