"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Play, RefreshCw } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  type JobAgentApplication,
  type JobAgentJob,
  type JobAssessment,
  extractedList,
  extractedText,
  humanize,
  jobAgentRequest,
  unwrapRecord,
} from "@/lib/job-agent/client";

function StringList({ values, empty = "None identified" }: { values?: string[]; empty?: string }) {
  if (!values?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {values.map((value) => (
        <li key={value} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
}

function reasonText(value: { reason?: string; message?: string; excerpt?: string; code?: string } | string) {
  if (typeof value === "string") return { reason: value, excerpt: "" };
  return {
    reason: value.reason ?? value.message ?? humanize(value.code),
    excerpt: value.excerpt ?? "",
  };
}

export function JobDetail({ jobId, assessmentOnly = false }: { jobId: string; assessmentOnly?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [job, setJob] = useState<JobAgentJob | null>(null);
  const [assessment, setAssessment] = useState<JobAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<Record<string, unknown>>(`/api/job-agent/jobs/${jobId}`);
      const loadedJob = unwrapRecord<JobAgentJob>(payload.job, ["job"]);
      const loadedAssessment = unwrapRecord<JobAssessment>(payload.assessment, ["assessment"]);
      setJob(loadedJob);
      setAssessment(loadedAssessment ?? loadedJob?.assessment ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recompute = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/jobs/${jobId}/assessment`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const next = unwrapRecord<JobAssessment>(payload, ["assessment"]);
      setAssessment(next);
      toast({ title: "Assessment refreshed" });
    } catch (assessmentError) {
      toast({
        title: "Assessment failed",
        description: assessmentError instanceof Error ? assessmentError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const createApplication = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>("/api/job-agent/applications", {
        method: "POST",
        body: JSON.stringify({ jobId }),
      });
      const application = unwrapRecord<JobAgentApplication>(payload, ["application"]);
      if (!application?.id) throw new Error("Application record was not returned");
      toast({ title: "Application workspace created" });
      router.push(`/applications/${application.id}`);
    } catch (applicationError) {
      toast({
        title: "Could not start application",
        description:
          applicationError instanceof Error ? applicationError.message : "Review eligibility and try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const fit = assessment?.fit;
  const eligibility = assessment?.eligibility;
  const score = fit?.score ?? job?.fitScore ?? 0;
  const eligibilityDecision = eligibility?.decision ?? eligibility?.status ?? job?.eligibility;
  const positioning = useMemo(() => {
    if (Array.isArray(fit?.recommendedPositioning)) return fit.recommendedPositioning;
    return fit?.recommendedPositioning ? [fit.recommendedPositioning] : [];
  }, [fit?.recommendedPositioning]);

  if (loading) {
    return <Skeleton className="h-[34rem] w-full rounded-xl" />;
  }
  if (error || !job) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle>Job unavailable</CardTitle>
          <CardDescription>{error ?? "The job record was not found."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline"><Link href="/jobs">Back to jobs</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={assessmentOnly ? "Eligibility and fit assessment" : "Job detail"}
        title={extractedText(job.title, "Untitled role")}
        description={`${extractedText(job.company, "Unknown company")}${job.location ? ` · ${extractedText(job.location)}` : ""}`}
        actions={
          <>
            <Button variant="outline" onClick={recompute} disabled={working}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reassess
            </Button>
            {!assessmentOnly ? (
              <Button onClick={createApplication} disabled={working || eligibilityDecision?.toLowerCase() === "ineligible"}>
                <Play className="mr-2 h-4 w-4" /> Start application
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[0.8fr,1.2fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Eligibility</CardTitle>
            <CardDescription>Deterministic rules run before any model-based fit advice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusPill value={eligibilityDecision} />
            {(eligibility?.reasons ?? []).map((item, index) => {
              const reason = reasonText(item);
              return (
                <div key={`${reason.reason}-${index}`} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{reason.reason}</p>
                  {reason.excerpt ? (
                    <blockquote className="mt-2 border-l-2 border-primary/30 pl-3 text-xs italic text-muted-foreground">
                      {reason.excerpt}
                    </blockquote>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Fit score</CardTitle>
                <CardDescription>Weighted evidence, never an eligibility override.</CardDescription>
              </div>
              <span className="text-3xl font-semibold">{score}/100</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={score} />
            <div className="grid gap-2 sm:grid-cols-2">
              {(fit?.categories ?? Object.entries(fit?.breakdown ?? {}).map(([category, value]) => ({
                category,
                awarded: typeof value === "number" ? value : value.score ?? 0,
                maximum: typeof value === "number" ? 0 : value.weight ?? 0,
              }))).map((value) => {
                const key = value.category;
                const categoryScore = value.awarded;
                const weight = value.maximum;
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{humanize(key)}</span>
                    <span className="font-semibold">{categoryScore ?? 0}{weight ? `/${weight}` : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Recommendation</span>
              <StatusPill value={fit?.recommendation} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Strong matches</CardTitle></CardHeader><CardContent><StringList values={fit?.strongMatches} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Transferable strengths</CardTitle></CardHeader><CardContent><StringList values={fit?.transferableStrengths} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Mandatory gaps</CardTitle></CardHeader><CardContent><StringList values={fit?.missingMandatoryRequirements} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Preferred gaps</CardTitle></CardHeader><CardContent><StringList values={fit?.missingPreferredRequirements} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Interview concerns</CardTitle></CardHeader><CardContent><StringList values={fit?.likelyInterviewConcerns} /></CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle className="text-base">Suggested positioning</CardTitle></CardHeader><CardContent><StringList values={positioning} /></CardContent></Card>
      </div>

      {!assessmentOnly ? (
        <>
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Structured requirements</CardTitle>
              <CardDescription>
                Inferred fields are labelled and remain reviewable against the source description.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <div><h3 className="mb-2 text-sm font-semibold">Responsibilities</h3><StringList values={extractedList(job.responsibilities)} /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Required skills</h3><StringList values={extractedList(job.requiredSkills)} /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Preferred skills</h3><StringList values={extractedList(job.preferredSkills)} /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Visa requirements</h3><StringList values={extractedList(job.visaRequirements)} /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Citizenship / clearance</h3><StringList values={[...extractedList(job.citizenshipRequirements), ...extractedList(job.clearanceRequirements ?? job.securityClearanceRequirements)]} /></div>
              <div><h3 className="mb-2 text-sm font-semibold">Inferred fields</h3><div className="flex flex-wrap gap-2">{job.inferredFields?.map((field) => <Badge key={field} variant="outline">{humanize(field)}</Badge>) ?? <span className="text-sm text-muted-foreground">None</span>}</div></div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Original description</CardTitle>
              <CardDescription>Preserved for transparent review and audit.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 font-sans text-sm leading-6">
                {job.originalDescription || "No original description was stored."}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
