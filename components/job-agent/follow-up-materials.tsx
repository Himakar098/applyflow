"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clipboard, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { jobAgentRequest } from "@/lib/job-agent/client";

type GroundedText = {
  text: string;
  evidenceClaimIds: string[];
  requiresUserReview: true;
  factsNeedingConfirmation: string[];
};

type MessageDraft = { subject?: string; body: GroundedText };

type FollowUpContent = {
  delivery: "draft_only";
  sent: false;
  recruiterFollowUpEmail: MessageDraft;
  hiringManagerLinkedInMessage: MessageDraft;
  thankYouMessageAfterInterview: MessageDraft;
  interviewPreparationBrief: {
    overview: GroundedText;
    verifiedStrengths: GroundedText[];
    roleSpecificQuestions: Array<{ question: string }>;
    companyResearchChecklist: string[];
  };
  starPreparation: Array<{
    prompt: string;
    suggestedEvidence: GroundedText;
    userInputRequired: true;
  }>;
};

type FollowUpRecord = {
  id: string;
  applicationId: string;
  content: FollowUpContent;
  truthfulness?: { valid?: boolean; issues?: unknown[] };
  createdAt: string;
  updatedAt: string;
};

type FollowUpPayload = {
  draft: FollowUpRecord | null;
  digest?: string | null;
};

function ReviewDraft({ title, description, draft }: { title: string; description: string; draft: MessageDraft }) {
  const { toast } = useToast();
  const copyValue = [draft.subject ? `Subject: ${draft.subject}` : "", draft.body.text].filter(Boolean).join("\n\n");
  return (
    <Card className="surface-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div>
          <Badge variant="outline">Review required</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft.subject ? <div><p className="text-xs text-muted-foreground">Subject</p><p className="font-medium">{draft.subject}</p></div> : null}
        <pre className="whitespace-pre-wrap rounded-lg border bg-white/70 p-4 font-sans text-sm leading-6">{draft.body.text}</pre>
        {draft.body.factsNeedingConfirmation.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">Confirm before using</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {draft.body.factsNeedingConfirmation.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          </div>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(copyValue).then(() => toast({ title: "Draft copied for your review" })).catch(() => toast({ title: "Copy failed", variant: "destructive" }))}>
          <Clipboard className="mr-2 h-4 w-4" />Copy reviewed draft
        </Button>
      </CardContent>
    </Card>
  );
}

export function FollowUpMaterials({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<FollowUpRecord | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<FollowUpPayload>(`/api/job-agent/applications/${applicationId}/follow-up`);
      setDraft(payload.draft);
      setDigest(payload.digest ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load follow-up materials");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<FollowUpPayload>(`/api/job-agent/applications/${applicationId}/follow-up`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setDraft(payload.draft);
      setDigest(payload.digest ?? null);
      setError(null);
      toast({ title: "Grounded drafts generated", description: "Nothing was sent. Review every placeholder and confirmation first." });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Draft generation was blocked");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <Skeleton className="h-[38rem] w-full rounded-xl" />;

  const content = draft?.content;
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="After submission"
        title="Follow-up and interview materials"
        description="Grounded, review-only drafts. ApplyFlow never sends email or LinkedIn messages for you."
        actions={<><Button asChild variant="outline"><Link href={`/applications/${applicationId}`}>Back to application</Link></Button><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={generate} disabled={working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{draft ? "Regenerate drafts" : "Generate drafts"}</Button></>}
      />

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" /><div><CardTitle className="text-base">Draft only — never automatically sent</CardTitle><CardDescription className="mt-1 text-blue-900">Generation is available only after a confirmed submission. Replace every [USER INPUT REQUIRED] placeholder and verify names, timing, and interview context yourself.</CardDescription></div></div></CardHeader>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle className="text-base text-red-950">Materials unavailable</CardTitle><CardDescription className="text-red-800">{error}</CardDescription></CardHeader></Card> : null}
      {!content ? <Card className="surface-card"><CardHeader><CardTitle>No follow-up pack yet</CardTitle><CardDescription>Once the application has a verified SUBMITTED state, generate a recruiter follow-up, LinkedIn note, interview thank-you draft, and preparation brief.</CardDescription></CardHeader></Card> : null}

      {content ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <ReviewDraft title="Recruiter follow-up" description="Email draft with application and candidate evidence." draft={content.recruiterFollowUpEmail} />
            <ReviewDraft title="Hiring-manager LinkedIn" description="Connection or message draft; confirm the recipient first." draft={content.hiringManagerLinkedInMessage} />
            <ReviewDraft title="Interview thank-you" description="Do not use unless the recorded interview actually occurred." draft={content.thankYouMessageAfterInterview} />
          </div>

          <Card className="surface-card">
            <CardHeader><CardTitle>Interview preparation brief</CardTitle><CardDescription>{content.interviewPreparationBrief.overview.text}</CardDescription></CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <section><h3 className="font-medium">Verified strengths</h3><ul className="mt-3 space-y-2">{content.interviewPreparationBrief.verifiedStrengths.map((strength) => <li key={strength.text} className="rounded-lg border p-3 text-sm">{strength.text}</li>)}</ul></section>
              <section><h3 className="font-medium">Role-specific questions</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{content.interviewPreparationBrief.roleSpecificQuestions.map((question) => <li key={question.question}>{question.question}</li>)}</ol></section>
              <section><h3 className="font-medium">Company research checklist</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{content.interviewPreparationBrief.companyResearchChecklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h3 className="font-medium">STAR preparation</h3><div className="mt-3 space-y-3">{content.starPreparation.map((item) => <div key={item.prompt} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-medium">{item.prompt}</p><p className="mt-2 text-sm text-amber-950">Suggested evidence: {item.suggestedEvidence.text}</p><p className="mt-2 text-xs text-amber-800">Add your factual situation, actions, and result. Metrics require confirmed evidence.</p></div>)}</div></section>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">Last generated {new Date(draft.updatedAt).toLocaleString()}{digest ? ` · Evidence digest ${digest.slice(0, 12)}…` : ""} · Truthfulness check {draft.truthfulness?.valid ? "passed" : "requires review"}</p>
        </>
      ) : null}
    </div>
  );
}
