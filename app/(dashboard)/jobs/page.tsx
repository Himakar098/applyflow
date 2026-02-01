"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, Plus } from "lucide-react";

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
import type { JobApplication, JobDraft, JobStatus } from "@/lib/types";

export default function JobsPage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [deletingJob, setDeletingJob] = useState<JobApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

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
      } else {
        const created = await createJobAction(idToken, values);
        setJobs((prev) => [created, ...prev]);
        toast({ title: "Application added" });
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

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Tracker
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Job applications
          </h2>
          <p className="text-sm text-muted-foreground">
            Keep statuses current for quick follow-ups and interviews.
          </p>
        </div>
        <Button onClick={() => setEditingJob(null)} className="gap-2">
          <Plus className="h-4 w-4" />
          New application
        </Button>
      </div>

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : <JobStats jobs={jobs} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5 lg:col-span-1">
          <CardHeader>
            <CardTitle>
              {editingJob ? "Edit application" : "Add new application"}
            </CardTitle>
            <CardDescription>
              Capture the essentials to keep your pipeline up to date.
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
              onCancel={() => setEditingJob(null)}
            />
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Table view with quick filters.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="ghosted">Ghosted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
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
