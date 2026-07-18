"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquareText, Save, WandSparkles } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { jobAgentRequest, unwrapList, type JobAgentApplication } from "@/lib/job-agent/client";

type Answer = NonNullable<JobAgentApplication["answers"]>[number];

const defaultQuestions = [
  "Why are you interested in this role?",
  "Describe your relevant experience.",
  "What are your salary expectations?",
  "What is your notice period?",
  "Do you have Australian working rights?",
  "Are you an Australian citizen?",
  "Are you an Australian permanent resident?",
  "Do you require sponsorship now or in the future?",
  "Do you hold an Australian driver licence?",
  "Do you hold an Australian security clearance?",
];

export function AnswersPanel({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/answers`);
      setAnswers(unwrapList<Answer>(payload, ["answers"]));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load answers");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/answers`, {
        method: "POST",
        body: JSON.stringify({ questions: defaultQuestions }),
      });
      setAnswers(unwrapList<Answer>(payload, ["answers"]));
      toast({ title: "Grounded answers proposed", description: "Visa and sponsorship wording still requires your review." });
    } catch (generationError) {
      toast({ title: "Answer generation failed", description: generationError instanceof Error ? generationError.message : "Try again.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const save = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/answers`, {
        method: "PUT",
        body: JSON.stringify({
          answers: answers.map((answer) => ({
            id: answer.id,
            proposedValue: answer.proposedValue ?? answer.proposedAnswer ?? answer.answer ?? "",
            confirmed: Boolean(answer.confirmed),
          })),
        }),
      });
      setAnswers(unwrapList<Answer>(payload, ["answers"]));
      toast({ title: "Answers saved" });
    } catch (saveError) {
      toast({ title: "Save failed", description: saveError instanceof Error ? saveError.message : "Try again.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const update = (index: number, patch: Partial<Answer>) => {
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? { ...answer, ...patch } : answer));
  };

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Application answer bank"
        title="Review every proposed answer before autofill."
        description="Citizenship, residency, clearance, licence, sponsorship, legal declarations, and demographic questions are fail-closed and never inferred from unrelated profile data."
        actions={<><Button asChild variant="outline"><Link href={`/applications/${applicationId}`}>Back to application</Link></Button><Button onClick={generate} disabled={working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Propose common answers</Button></>}
      />

      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-950"><MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" /><p>“Full Australian working rights” depends on the current visa conditions you entered. Sponsorship wording can have immigration consequences, so confirm it against the exact portal question.</p></CardContent>
      </Card>

      {loading ? <Skeleton className="h-96 w-full rounded-xl" /> : error ? (
        <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle>Answers unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>
      ) : answers.length === 0 ? (
        <Card className="surface-card"><CardContent className="p-10 text-center"><p className="font-medium">No proposed answers yet</p><p className="mt-1 text-sm text-muted-foreground">Generate the common answer bank, then edit and confirm each sensitive response.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {answers.map((answer, index) => {
            const value = answer.proposedValue ?? answer.proposedAnswer ?? answer.answer ?? "";
            const reviewRequired = answer.requiresReview !== false;
            return (
              <Card key={answer.id ?? `${answer.question}-${index}`} className="surface-card">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle className="text-base">{answer.question}</CardTitle><CardDescription>Source: {answer.source ?? "candidate profile and verified evidence"}</CardDescription></div><div className="flex gap-2"><StatusPill value={reviewRequired ? "needs_review" : "verified"} />{answer.risk ? <StatusPill value={answer.risk} /> : null}</div></div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor={`answer-${index}`}>Proposed answer</Label>
                  <Textarea id={`answer-${index}`} value={value} onChange={(event) => update(index, { proposedValue: event.target.value, confirmed: false })} className="min-h-28" />
                  <div className="flex items-start gap-2 rounded-lg border p-3">
                    <Checkbox id={`confirm-${index}`} checked={Boolean(answer.confirmed)} onCheckedChange={(checked) => update(index, { confirmed: checked === true })} />
                    <Label htmlFor={`confirm-${index}`} className="font-normal leading-5">I reviewed this exact answer and confirm it is accurate for this application.</Label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-end"><Button onClick={save} disabled={working}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save reviewed answers</Button></div>
        </div>
      )}
    </div>
  );
}

