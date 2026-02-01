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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { fetchJobs as fetchJobsAction } from "@/app/actions/jobs";
import { fetchResumes as fetchResumesAction } from "@/app/actions/resumes";
import { useAuth } from "@/lib/auth/auth-provider";
import type { JobApplication, ResumeRecord } from "@/lib/types";

export default function DashboardPage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const idToken = token ?? (await refreshToken());
        if (!idToken) return;
        const [jobsData, resumeData] = await Promise.all([
          fetchJobsAction(idToken),
          fetchResumesAction(idToken),
        ]);
        setJobs(jobsData);
        setResumes(resumeData);
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

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-white to-white shadow-lg shadow-primary/10">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5 lg:col-span-2">
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
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader>
            <CardTitle>Latest resume</CardTitle>
            <CardDescription>Stored securely and ready for AI tailoring.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : latestResume ? (
              <div className="rounded-xl border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
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
  );
}
