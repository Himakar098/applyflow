"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, Plus } from "lucide-react";
import Link from "next/link";

import { JobForm } from "@/components/jobs/job-form";
import { JobStats } from "@/components/jobs/job-stats";
import { JobTable } from "@/components/jobs/job-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  createJob as createJobAction,
  deleteJob as deleteJobAction,
  fetchJobs as fetchJobsAction,
  updateJob as updateJobAction,
} from "@/app/actions/jobs";
import { useAuth } from "@/lib/auth/auth-provider";
import { trackGamificationEvent } from "@/lib/gamification/client";
import type { JobApplication, JobDraft, JobStatus } from "@/lib/types";

export default function JobsPage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [deletingJob, setDeletingJob] = useState<JobApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [followUpFilter, setFollowUpFilter] = useState<
    "all" | "overdue" | "due_soon" | "no_date" | "has_date"
  >("all");
  const [sortBy, setSortBy] = useState<"priority" | "updated" | "follow_up" | "applied" | "status">("priority");
  const [showForm, setShowForm] = useState(false);

  const loadJobs = async () => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const data = await fetchJobsAction(idToken);
      setJobs(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to fetch jobs",
        description: "Check your Firebase configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingJob) {
      setShowForm(true);
    }
  }, [editingJob]);

  const handleSubmit = async (values: JobDraft) => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        return;
      }

      if (editingJob) {
        const updated = await updateJobAction(idToken, editingJob.id, values);
        setJobs((prev) =>
          prev.map((job) => (job.id === updated.id ? updated : job)),
        );
        toast({ title: "Application updated" });
        setEditingJob(null);
        setShowForm(false);
      } else {
        const created = await createJobAction(idToken, values);
        setJobs((prev) => [created, ...prev]);
        await trackGamificationEvent("job_saved");
        toast({ title: "Application added" });
        setShowForm(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save application",
        description: "Try again after verifying Firebase rules.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deletingJob) return;
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      await deleteJobAction(idToken, deletingJob.id);
      setJobs((prev) => prev.filter((job) => job.id !== deletingJob.id));
      toast({ title: "Application removed" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Delete failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingJob(null);
    }
  };

  const parseDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const filteredJobs = useMemo(() => {
    let next = [...jobs];
    if (statusFilter !== "all") {
      next = next.filter((job) => job.status === statusFilter);
    }

    if (followUpFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 7);

      next = next.filter((job) => {
        const date = parseDate(job.followUpDate);
        if (followUpFilter === "no_date") return !date;
        if (followUpFilter === "has_date") return Boolean(date);
        if (!date) return false;
        if (followUpFilter === "overdue") return date < today;
        if (followUpFilter === "due_soon") return date >= today && date <= soon;
        return true;
      });
    }

    const statusRank: Record<JobStatus, number> = {
      saved: 0,
      applied: 1,
      interview: 2,
      offer: 3,
      rejected: 4,
      ghosted: 5,
    };

    const followUpBucket = (job: JobApplication) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 7);
      const date = parseDate(job.followUpDate);
      if (!date) return { bucket: 3, date: null };
      if (date < today) return { bucket: 0, date };
      if (date <= soon) return { bucket: 1, date };
      return { bucket: 2, date };
    };

    const compareDatesDesc = (a?: string, b?: string) =>
      (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0);
    const compareDatesAsc = (a?: string, b?: string) =>
      (parseDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (parseDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER);

    next.sort((a, b) => {
      if (sortBy === "updated") return compareDatesDesc(a.updatedAt, b.updatedAt);
      if (sortBy === "applied") return compareDatesDesc(a.appliedDate, b.appliedDate);
      if (sortBy === "follow_up") return compareDatesAsc(a.followUpDate, b.followUpDate);
      if (sortBy === "status") return statusRank[a.status] - statusRank[b.status];

      const fa = followUpBucket(a);
      const fb = followUpBucket(b);
      if (fa.bucket !== fb.bucket) return fa.bucket - fb.bucket;
      if (fa.date && fb.date && fa.date.getTime() !== fb.date.getTime()) {
        return fa.date.getTime() - fb.date.getTime();
      }
      return compareDatesDesc(a.updatedAt, b.updatedAt);
    });

    return next;
  }, [jobs, statusFilter, followUpFilter, sortBy]);

  const followUpGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 7);

    const overdue = jobs.filter((job) => {
      const date = parseDate(job.followUpDate);
      return date && date < today;
    });
    const dueSoon = jobs.filter((job) => {
      const date = parseDate(job.followUpDate);
      return date && date >= today && date <= soon;
    });

    return {
      overdue: overdue.sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || "")).slice(0, 6),
      dueSoon: dueSoon.sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || "")).slice(0, 6),
    };
  }, [jobs]);

  const updateFollowUp = async (jobId: string, nextDate: string): Promise<boolean> => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return false;
      const updated = await updateJobAction(idToken, jobId, { followUpDate: nextDate });
      setJobs((prev) => prev.map((job) => (job.id === updated.id ? updated : job)));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update follow-up";
      toast({ title: "Follow-up update failed", description: message, variant: "destructive" });
      return false;
    }
  };

  const clearFollowUp = async (jobId: string) => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const updated = await updateJobAction(idToken, jobId, { followUpDate: "" });
      setJobs((prev) => prev.map((job) => (job.id === updated.id ? updated : job)));
      toast({ title: "Follow-up cleared" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to clear follow-up";
      toast({ title: "Follow-up update failed", description: message, variant: "destructive" });
    }
  };

  const snoozeFollowUp = async (jobId: string, days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const ok = await updateFollowUp(jobId, date.toISOString().slice(0, 10));
    if (ok) {
      toast({ title: `Follow-up snoozed ${days} days` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Tracker
            </p>
            <h2 className="text-3xl font-semibold text-foreground">Your application pipeline</h2>
            <p className="text-sm text-muted-foreground">
              Keep statuses current, follow up on time, and move interviews forward.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingJob(null);
              setShowForm(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New application
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : <JobStats jobs={jobs} />}

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Follow-up reminders</CardTitle>
            <CardDescription>Stay ahead of responses and deadlines.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="chip">Overdue: {followUpGroups.overdue.length}</span>
            <span className="chip">Next 7 days: {followUpGroups.dueSoon.length}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : followUpGroups.overdue.length === 0 && followUpGroups.dueSoon.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No follow-ups scheduled. Add a follow-up date in the job tracker to get reminders.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {[{ label: "Overdue", items: followUpGroups.overdue }, { label: "Due soon", items: followUpGroups.dueSoon }].map(
                (group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    {group.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nothing here yet.</p>
                    ) : (
                      group.items.map((job) => (
                        <div
                          key={job.id}
                          className="flex flex-col gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.company}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:ml-auto">
                            <Badge variant="outline" className="border-primary/30 text-primary">
                              {job.followUpDate ? new Date(job.followUpDate).toLocaleDateString() : "No date"}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => snoozeFollowUp(job.id, 2)}>
                              Snooze 2d
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => snoozeFollowUp(job.id, 7)}>
                              Snooze 7d
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => clearFollowUp(job.id)}>
                              Clear
                            </Button>
                            <Button size="sm" asChild>
                              <Link href={`/jobs/${job.id}`}>Open</Link>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm ? (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>
              {editingJob ? "Edit application" : "Add new application"}
            </CardTitle>
            <CardDescription>
              Save roles from recommendations or add one manually here.
            </CardDescription>
            {editingJob ? (
              <Badge variant="outline" className="w-fit border-primary/30 text-primary">
                Editing {editingJob.title} @ {editingJob.company}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            <JobForm
              defaultValues={editingJob ?? undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setEditingJob(null);
                setShowForm(false);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Table view with quick filters.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as JobStatus | "all")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="saved">Saved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="ghosted">Ghosted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={followUpFilter} onValueChange={(value) => setFollowUpFilter(value as typeof followUpFilter)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Follow-ups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All follow-ups</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_soon">Due in 7 days</SelectItem>
                  <SelectItem value="has_date">Has follow-up</SelectItem>
                  <SelectItem value="no_date">No follow-up</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Smart priority</SelectItem>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="follow_up">Follow-up date</SelectItem>
                  <SelectItem value="applied">Applied date</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <JobTable
                  jobs={filteredJobs}
                  onEdit={(job) => setEditingJob(job)}
                  onDelete={(job) => setDeletingJob(job)}
                />
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(deletingJob)} onOpenChange={() => setDeletingJob(null)}>
        <AlertDialogContent aria-describedby="delete-application-description">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application</AlertDialogTitle>
            <AlertDialogDescription id="delete-application-description">
              This will remove {deletingJob?.title} at {deletingJob?.company} from your tracker.
              You can re-add it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingJob(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
