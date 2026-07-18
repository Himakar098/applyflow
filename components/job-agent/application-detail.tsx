"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, FileText, ListChecks, Loader2, MessagesSquare, RefreshCw } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import { TrackingEditor } from "@/components/job-agent/tracking-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  type JobAgentApplication,
  type JobAgentJob,
  type JobAssessment,
  extractedText,
  jobAgentRequest,
  unwrapList,
  unwrapRecord,
} from "@/lib/job-agent/client";

const statusOrder = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED_FOR_AUTOFILL",
  "AUTOFILL_IN_PROGRESS",
  "AUTOFILL_PAUSED",
  "READY_TO_SUBMIT",
  "SUBMISSION_APPROVED",
  "SUBMITTED",
];

type DetailState = {
  application: JobAgentApplication;
  job: JobAgentJob | null;
  assessment: JobAssessment | null;
  documents: JobAgentApplication["documents"];
  answers: JobAgentApplication["answers"];
};

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<Record<string, unknown>>(`/api/job-agent/applications/${applicationId}`);
      const application = unwrapRecord<JobAgentApplication>(payload.application, ["application"]);
      if (!application) throw new Error("Application was not found");
      setState({
        application,
        job: unwrapRecord<JobAgentJob>(payload.job, ["job"]),
        assessment: unwrapRecord<JobAssessment>(payload.assessment, ["assessment"]),
        documents: unwrapList(payload.documents, ["documents"]),
        answers: unwrapList(payload.answers, ["answers"]),
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load application");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markReadyForReview = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(
        `/api/job-agent/applications/${applicationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "READY_FOR_REVIEW" }),
        },
      );
      const updated = unwrapRecord<JobAgentApplication>(payload, ["application"]);
      if (updated) {
        setState((current) =>
          current ? { ...current, application: { ...current.application, ...updated } } : current,
        );
      }
      toast({ title: "Application is ready for autofill-plan review" });
    } catch (transitionError) {
      toast({
        title: "State change blocked",
        description: transitionError instanceof Error ? transitionError.message : "Review the application first.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Skeleton className="h-[36rem] w-full rounded-xl" />;
  if (error || !state) {
    return <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle>Application unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>;
  }

  const { application, job, assessment, documents, answers } = state;
  const currentIndex = statusOrder.indexOf(application.status);
  const progress = currentIndex < 0 ? 0 : (currentIndex / (statusOrder.length - 1)) * 100;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Supervised application"
        title={application.role ?? application.title ?? extractedText(job?.title, "Application")}
        description={`${application.company ?? extractedText(job?.company, "Unknown company")} · Every browser side effect and submission approval is recorded.`}
        actions={
          <>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            {application.status === "DRAFT" ? (
              <Button onClick={markReadyForReview} disabled={working}>
                {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Mark ready for review
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="surface-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Approval state</CardTitle><CardDescription>Autofill and final submission are two separate approvals.</CardDescription></div>
            <StatusPill value={application.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {statusOrder.map((status, index) => (
              <div key={status} className={`rounded-lg border px-3 py-2 text-xs ${index <= currentIndex ? "border-primary/30 bg-primary/5 text-primary" : "text-muted-foreground"}`}>
                {index + 1}. {status.replaceAll("_", " ")}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Eligibility</CardTitle></CardHeader><CardContent><StatusPill value={application.eligibility ?? assessment?.eligibility?.decision ?? assessment?.eligibility?.status} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Fit score</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{application.fitScore ?? assessment?.fit?.score ?? "—"}<span className="text-sm text-muted-foreground">/100</span></p></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{documents?.length ?? 0}</p></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Answers</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{answers?.length ?? 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="surface-card">
          <CardHeader><FileText className="h-5 w-5 text-primary" /><CardTitle className="text-base">Documents</CardTitle><CardDescription>Generate and export a grounded resume and cover letter.</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full"><Link href={`/applications/${applicationId}/documents`}>Review documents</Link></Button></CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader><ListChecks className="h-5 w-5 text-primary" /><CardTitle className="text-base">Application answers</CardTitle><CardDescription>Confirm visa-sensitive and uncertain answers explicitly.</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full"><Link href={`/applications/${applicationId}/answers`}>Review answers</Link></Button></CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader><Bot className="h-5 w-5 text-primary" /><CardTitle className="text-base">Visible browser</CardTitle><CardDescription>Inspect, approve, autofill, then stop before Submit.</CardDescription></CardHeader>
          <CardContent><Button asChild className="w-full"><Link href={`/applications/${applicationId}/autofill`}>Open autofill console</Link></Button></CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader><MessagesSquare className="h-5 w-5 text-primary" /><CardTitle className="text-base">Follow-up pack</CardTitle><CardDescription>Review-only recruiter, LinkedIn, thank-you, and interview drafts.</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full"><Link href={`/applications/${applicationId}/follow-up`}>Open follow-up pack</Link></Button></CardContent>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader><CardTitle>Tracking details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Application URL</p>{application.applicationUrl ? <a href={application.applicationUrl} target="_blank" rel="noreferrer" className="break-all text-primary underline">Open employer portal</a> : <p>Not set</p>}</div>
          <div><p className="text-xs text-muted-foreground">Closing date</p><p>{application.closingDate ?? "Not set"}</p></div>
          <div><p className="text-xs text-muted-foreground">Follow-up date</p><p>{application.followUpDate ?? "Not set"}</p></div>
          <div><p className="text-xs text-muted-foreground">Resume used</p><p>{application.resumeUsed ?? "Not selected"}</p></div>
          <div><p className="text-xs text-muted-foreground">Cover letter used</p><p>{application.coverLetterUsed ?? "Not selected"}</p></div>
          <div><p className="text-xs text-muted-foreground">Date applied</p><p>{application.dateApplied ?? "Not submitted"}</p></div>
        </CardContent>
      </Card>

      <TrackingEditor
        application={application}
        onSaved={(updated) => setState((current) =>
          current ? { ...current, application: { ...current.application, ...updated } } : current,
        )}
      />
    </div>
  );
}
