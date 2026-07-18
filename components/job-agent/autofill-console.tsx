"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clipboard, Pause, Play, RefreshCw, ShieldAlert } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { humanize, jobAgentRequest, type JobAgentApplication } from "@/lib/job-agent/client";

type PlanField = {
  id: string;
  label: string;
  detectedFieldType?: string;
  proposedValue?: string;
  source?: string;
  confidence?: number;
  requiresUserReview?: boolean;
  approved?: boolean;
  sensitive?: boolean;
};

type BridgeMapping = {
  field?: { id?: string; label?: string; kind?: string; required?: boolean; sensitiveCategory?: string };
  proposedValue?: string | number | boolean;
  sourceLabel?: string;
  confidence?: number;
  reviewRequired?: boolean;
  status?: string;
  reason?: string;
};

type AutofillPlan = {
  id?: string;
  applicationId?: string;
  url?: string;
  portal?: string;
  fields?: PlanField[];
  mappings?: BridgeMapping[];
  unknownQuestions?: string[];
  detectedChallenges?: string[];
  pauses?: Array<{ code?: string; message?: string; severity?: string }>;
  documentUploads?: Array<{ fieldLabel?: string; documentId?: string; approved?: boolean }>;
};

type AutofillPayload = {
  application?: JobAgentApplication;
  plan?: AutofillPlan | null;
  workerPlan?: AutofillPlan | null;
  approval?: { status?: string; planHash?: string } | null;
  session?: {
    status?: string;
    currentPage?: string;
    message?: string;
    screenshots?: string[];
    activity?: Array<{ timestamp?: string; action?: string; message?: string }>;
    filledFieldIds?: string[];
  } | null;
};

function normaliseFields(plan: AutofillPlan | null | undefined): PlanField[] {
  if (plan?.fields) return plan.fields;
  return (plan?.mappings ?? []).map((mapping, index) => ({
    id: mapping.field?.id ?? `field-${index}`,
    label: mapping.field?.label ?? "Unknown field",
    detectedFieldType: mapping.field?.kind,
    proposedValue: mapping.proposedValue === undefined ? "" : String(mapping.proposedValue),
    source: mapping.sourceLabel,
    confidence: mapping.confidence,
    requiresUserReview: mapping.reviewRequired,
    approved: mapping.status === "ready" && !mapping.reviewRequired,
    sensitive: mapping.field?.sensitiveCategory !== "none",
  }));
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function AutofillConsole({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();
  const [payload, setPayload] = useState<AutofillPayload>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [approvedFieldIds, setApprovedFieldIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, approvalPayload] = await Promise.all([
        jobAgentRequest<AutofillPayload>(`/api/job-agent/applications/${applicationId}/autofill`),
        jobAgentRequest<AutofillPayload>(`/api/job-agent/applications/${applicationId}/approval`),
      ]);
      setPayload({ ...next, approval: approvalPayload.approval ?? null });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the autofill console");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const action = async (body: Record<string, unknown>, success: string) => {
    setWorking(true);
    try {
      const next = await jobAgentRequest<AutofillPayload>(`/api/job-agent/applications/${applicationId}/autofill`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPayload((current) => ({ ...current, ...next }));
      toast({ title: success });
    } catch (actionError) {
      toast({ title: "Action blocked", description: actionError instanceof Error ? actionError.message : "The safety gate rejected this action.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const grantSubmissionApproval = async () => {
    const planHash = payload.application?.autofillPlanHash;
    if (typeof planHash !== "string" || !planHash) return;
    setWorking(true);
    try {
      const next = await jobAgentRequest<AutofillPayload>(`/api/job-agent/applications/${applicationId}/approval`, {
        method: "POST",
        body: JSON.stringify({ planHash }),
      });
      setPayload((current) => ({ ...current, ...next }));
      toast({ title: "One submission approved", description: "This approval is bound to this application and exact plan, and is consumed after one attempt." });
    } catch (approvalError) {
      toast({ title: "Approval blocked", description: approvalError instanceof Error ? approvalError.message : "Review the application state.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const application = payload.application;
  const plan = payload.plan;
  const fields = useMemo(() => normaliseFields(plan), [plan]);
  const applicationUrl = application?.applicationUrl ?? plan?.url;
  const workerCommand = `npm run browser:worker -- run ${shellQuote(applicationId)}`;
  const status = application?.status ?? payload.session?.status ?? "DRAFT";
  const filledCount = payload.session?.filledFieldIds?.length ?? approvedFieldIds.size;

  if (loading) return <Skeleton className="h-[44rem] w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Visible browser assistant"
        title="Inspect, review, autofill, then stop before submission."
        description="The local Chromium profile stays visible so you can log in manually and solve CAPTCHA or MFA yourself. The worker never stores employer passwords or bypasses a challenge."
        actions={<><Button asChild variant="outline"><Link href={`/applications/${applicationId}`}>Back to application</Link></Button><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></>}
      />

      {error ? <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle>Browser console is not ready</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr,1.35fr]">
        <Card className="surface-card">
          <CardHeader><div className="flex items-center justify-between gap-2"><div><CardTitle>Live session</CardTitle><CardDescription>Persistent local Chromium; never headless by default.</CardDescription></div><StatusPill value={status} /></div></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-xs text-muted-foreground">Current page</p><p className="break-all text-sm">{payload.session?.currentPage ?? applicationUrl ?? "No page connected"}</p></div>
            <div className="space-y-2"><div className="flex justify-between text-xs"><span>Approved or filled fields</span><span>{filledCount}/{fields.length}</span></div><Progress value={fields.length ? (filledCount / fields.length) * 100 : 0} /></div>
            <div className="rounded-lg border bg-muted/30 p-3"><p className="mb-2 text-xs font-medium">Start the authenticated local worker</p><code className="block overflow-x-auto whitespace-nowrap text-xs">{workerCommand}</code><p className="mt-2 text-xs text-muted-foreground">Requires the short-lived Firebase ID token and separate worker token described in the setup guide.</p><Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(workerCommand).then(() => toast({ title: "Worker command copied" })).catch(() => toast({ title: "Copy failed", description: "Select and copy the command manually.", variant: "destructive" }))}><Clipboard className="mr-2 h-3.5 w-3.5" />Copy command</Button></div>
            <div className="flex flex-wrap gap-2">
              {status === "READY_FOR_REVIEW" && !plan ? (
                <Button onClick={() => action({ action: "inspect" }, "Visible browser inspection requested")} disabled={working || !applicationUrl}>
                  <Play className="mr-2 h-4 w-4" /> Request inspection
                </Button>
              ) : null}
              {status === "READY_FOR_REVIEW" && plan ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button disabled={working || approvedFieldIds.size === 0}>Approve autofill plan</Button></AlertDialogTrigger>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve this autofill plan?</AlertDialogTitle><AlertDialogDescription>You are authorising only the checked fields shown for this application. Checked review-required fields count as individually reviewed. This does not approve final submission.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => action({ action: "approve_autofill", expectedPlanHash: application?.autofillPlanHash, approvedFieldIds: [...approvedFieldIds], reviewedFieldIds: fields.filter((field) => field.requiresUserReview && approvedFieldIds.has(field.id)).map((field) => field.id), explicitUserApproval: true }, "Autofill plan approved")}>Approve {approvedFieldIds.size} fields</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
              ) : null}
              {status === "APPROVED_FOR_AUTOFILL" ? <Button onClick={() => action({ action: "start", userInitiated: true }, "Autofill started in the visible browser")} disabled={working}><Play className="mr-2 h-4 w-4" />Start autofill</Button> : null}
              {status === "AUTOFILL_IN_PROGRESS" ? <Button variant="outline" onClick={() => action({ action: "pause", reason: "User paused from the ApplyFlow console" }, "Autofill paused")} disabled={working}><Pause className="mr-2 h-4 w-4" />Pause</Button> : null}
              {status === "AUTOFILL_PAUSED" ? <Button onClick={() => action({ action: "resume", userInitiated: true }, "Autofill resumed")} disabled={working}><Play className="mr-2 h-4 w-4" />Resume</Button> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-red-700" /><div><CardTitle className="text-red-950">Final submission gate</CardTitle><CardDescription className="text-red-800">Separate per-application approval. Never implied by autofill approval.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-950">The final Submit, Apply, or Confirm control remains untouched until all unknown questions and challenges are resolved, the application is READY_TO_SUBMIT, and you grant this one-use approval.</p>
            <div className="flex flex-wrap items-center gap-2"><StatusPill value={payload.approval?.status ?? "not_approved"} />{application?.autofillPlanHash ? <Badge variant="outline">Plan {application.autofillPlanHash.slice(0, 10)}…</Badge> : null}</div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" disabled={working || status !== "READY_TO_SUBMIT" || !application?.autofillPlanHash}>Approve one final submission</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve final submission for this application?</AlertDialogTitle><AlertDialogDescription>This grants a single-use approval tied to the current plan. Confirm that you reviewed the live portal, uploaded files, answers, declarations, and employer terms. Any plan change invalidates the approval.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep reviewing</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={grantSubmissionApproval}>Approve one submission</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
            {status !== "READY_TO_SUBMIT" ? <p className="text-xs text-red-800">Available only after the visible worker finishes autofill with no unresolved challenge.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader><CardTitle>Detected fields</CardTitle><CardDescription>Proposed values include their source, confidence, and review requirement.</CardDescription></CardHeader>
        <CardContent>
          {fields.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Run a form inspection in the visible worker, save its plan, then refresh this console.</p> : (
            <div className="divide-y rounded-xl border bg-white/70">{fields.map((field) => <div key={field.id} className="grid gap-3 p-4 md:grid-cols-[auto,1.2fr,1fr,0.7fr] md:items-center"><Checkbox aria-label={`Approve ${field.label}`} checked={approvedFieldIds.has(field.id)} disabled={!field.proposedValue} onCheckedChange={(checked) => setApprovedFieldIds((current) => { const next = new Set(current); if (checked === true) next.add(field.id); else next.delete(field.id); return next; })} /><div><p className="text-sm font-medium">{field.label}</p><p className="text-xs text-muted-foreground">{humanize(field.detectedFieldType)} · {field.source ?? "No grounded source"}</p></div><p className="break-words text-sm">{field.sensitive ? "Value hidden; check only after reviewing it in the live portal" : field.proposedValue || "No value proposed"}</p><div className="flex flex-wrap gap-2 md:justify-end"><Badge variant="outline">{Math.round((field.confidence ?? 0) * 100)}%</Badge><StatusPill value={field.requiresUserReview ? "needs_review" : approvedFieldIds.has(field.id) ? "verified" : "ready_for_review"} /></div></div>)}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card"><CardHeader><CardTitle>Questions and challenges</CardTitle></CardHeader><CardContent className="space-y-2">{[...(plan?.unknownQuestions ?? []), ...(plan?.detectedChallenges ?? []), ...(plan?.pauses ?? []).map((pause) => pause.message ?? pause.code ?? "Pause required")].length ? [...(plan?.unknownQuestions ?? []), ...(plan?.detectedChallenges ?? []), ...(plan?.pauses ?? []).map((pause) => pause.message ?? pause.code ?? "Pause required")].map((item) => <div key={item} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{item}</div>) : <p className="text-sm text-muted-foreground">No unresolved challenges recorded.</p>}</CardContent></Card>
        <Card className="surface-card"><CardHeader><CardTitle>Activity log</CardTitle></CardHeader><CardContent className="space-y-2">{payload.session?.activity?.length ? payload.session.activity.map((event, index) => <div key={`${event.timestamp}-${index}`} className="rounded-lg border p-3"><p className="text-sm font-medium">{humanize(event.action)}</p><p className="text-xs text-muted-foreground">{event.message} {event.timestamp ? `· ${new Date(event.timestamp).toLocaleTimeString()}` : ""}</p></div>) : payload.session?.message ? <div className="rounded-lg border p-3 text-sm">{payload.session.message}</div> : <p className="text-sm text-muted-foreground">No browser activity recorded yet.</p>}</CardContent></Card>
      </div>
    </div>
  );
}
