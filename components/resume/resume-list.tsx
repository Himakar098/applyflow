"use client";

import Link from "next/link";
import { Download, FileText, Sparkles, Trash } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import type { ResumeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<ResumeRecord["status"], string> = {
  uploaded: "bg-primary/10 text-primary",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
};

export function ResumeList({
  resumes,
  onDeleted,
}: {
  resumes: ResumeRecord[];
  onDeleted?: (id: string) => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<ResumeRecord | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  if (resumes.length === 0) {
    return (
      <Card className="surface-card">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            No resumes yet
          </div>
          <p className="text-lg font-semibold text-foreground">
            Upload your first resume
          </p>
          <p className="text-sm text-muted-foreground">
            Keep a single source of truth and prepare it for AI optimization.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Stored resumes</CardTitle>
          <CardDescription>Versioned and ready for ATS-safe export.</CardDescription>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          AI optimizations coming soon
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="space-y-3">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium leading-tight text-foreground">
                      {resume.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resume.uploadedAt
                        ? `Uploaded ${new Date(resume.uploadedAt).toLocaleDateString()}`
                        : "Upload date unavailable"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent text-xs font-semibold",
                      statusStyles[resume.status],
                    )}
                  >
                    {resume.status.charAt(0).toUpperCase() + resume.status.slice(1)}
                  </Badge>
                  <Button variant="outline" size="icon" asChild disabled={!resume.downloadUrl}>
                    <Link
                      href={resume.downloadUrl || "#"}
                      target="_blank"
                      aria-label="Download resume"
                      onClick={(event) => {
                        if (!resume.downloadUrl) event.preventDefault();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete resume"
                    onClick={() => setDeleting(resume)}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <AlertDialog open={Boolean(deleting)} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent aria-describedby="delete-resume-description">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resume</AlertDialogTitle>
            <AlertDialogDescription id="delete-resume-description">
              This will delete the resume file from storage and remove its record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleting(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                setDeletingBusy(true);
                try {
                  const headers = await getAuthHeader();
                  if (!headers) throw new Error("auth_required");
                  const res = await fetch(`/api/resumes/${deleting.id}`, {
                    method: "DELETE",
                    headers,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Delete failed");
                  toast({ title: "Resume deleted" });
                  onDeleted?.(deleting.id);
                  setDeleting(null);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Delete failed";
                  toast({ title: "Delete failed", description: message, variant: "destructive" });
                } finally {
                  setDeletingBusy(false);
                }
              }}
              disabled={deletingBusy}
            >
              {deletingBusy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
