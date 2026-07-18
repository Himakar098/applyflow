"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  jobAgentRequest,
  unwrapRecord,
  type JobAgentApplication,
} from "@/lib/job-agent/client";

type Stage = NonNullable<JobAgentApplication["interviewStages"]>[number];

export function TrackingEditor({
  application,
  onSaved,
}: {
  application: JobAgentApplication;
  onSaved: (application: JobAgentApplication) => void;
}) {
  const { toast } = useToast();
  const [working, setWorking] = useState(false);
  const [contactPerson, setContactPerson] = useState(application.contactPerson ?? "");
  const [followUpDate, setFollowUpDate] = useState(application.followUpDate?.slice(0, 10) ?? "");
  const [resumeUsed, setResumeUsed] = useState(application.resumeUsed ?? "");
  const [coverLetterUsed, setCoverLetterUsed] = useState(application.coverLetterUsed ?? "");
  const [notes, setNotes] = useState(application.notes ?? "");
  const [outcome, setOutcome] = useState(application.outcome ?? "");
  const [stages, setStages] = useState<Stage[]>(application.interviewStages ?? []);

  useEffect(() => {
    setContactPerson(application.contactPerson ?? "");
    setFollowUpDate(application.followUpDate?.slice(0, 10) ?? "");
    setResumeUsed(application.resumeUsed ?? "");
    setCoverLetterUsed(application.coverLetterUsed ?? "");
    setNotes(application.notes ?? "");
    setOutcome(application.outcome ?? "");
    setStages(application.interviewStages ?? []);
  }, [application]);

  const save = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(
        `/api/job-agent/applications/${application.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            contactPerson: contactPerson || null,
            followUpDate: followUpDate || null,
            resumeUsed: resumeUsed || null,
            coverLetterUsed: coverLetterUsed || null,
            notes: notes || null,
            outcome: outcome || null,
            interviewStages: stages.map((stage) => ({
              ...stage,
              scheduledAt: stage.scheduledAt || null,
              notes: stage.notes || null,
            })),
          }),
        },
      );
      const updated = unwrapRecord<JobAgentApplication>(payload, ["application"]);
      if (updated) onSaved(updated);
      toast({ title: "Application tracking updated" });
    } catch (saveError) {
      toast({
        title: "Tracking update failed",
        description: saveError instanceof Error ? saveError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const updateStage = (id: string, patch: Partial<Stage>) => {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
    );
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>Tracking and follow-up</CardTitle>
        <CardDescription>
          Keep recruiter details, documents used, interview stages, notes, and the next follow-up date current.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="tracking-contact">Contact person</Label>
            <Input id="tracking-contact" value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tracking-follow-up">Follow-up date</Label>
            <Input id="tracking-follow-up" type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tracking-resume">Resume used</Label>
            <Input id="tracking-resume" value={resumeUsed} onChange={(event) => setResumeUsed(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tracking-cover-letter">Cover letter used</Label>
            <Input id="tracking-cover-letter" value={coverLetterUsed} onChange={(event) => setCoverLetterUsed(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tracking-notes">Notes</Label>
            <Textarea id="tracking-notes" className="min-h-32" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tracking-outcome">Outcome</Label>
            <Textarea id="tracking-outcome" className="min-h-32" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Screening result, rejection reason, offer details, or other outcome" />
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Interview stages</h3>
              <p className="text-sm text-muted-foreground">Add each planned or completed stage.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStages((current) => [
                ...current,
                {
                  id: `stage-${crypto.randomUUID()}`,
                  stage: "Interview",
                  status: "planned",
                  scheduledAt: null,
                  notes: null,
                },
              ])}
            >
              <Plus className="mr-2 h-4 w-4" /> Add stage
            </Button>
          </div>
          {stages.map((stage) => (
            <div key={stage.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr,0.8fr,1fr,1.4fr,auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor={`${stage.id}-name`}>Stage</Label>
                <Input id={`${stage.id}-name`} value={stage.stage} onChange={(event) => updateStage(stage.id, { stage: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={stage.status} onValueChange={(value) => updateStage(stage.id, { status: value as Stage["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${stage.id}-date`}>Scheduled</Label>
                <Input id={`${stage.id}-date`} type="datetime-local" value={stage.scheduledAt?.slice(0, 16) ?? ""} onChange={(event) => updateStage(stage.id, { scheduledAt: event.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${stage.id}-notes`}>Stage notes</Label>
                <Input id={`${stage.id}-notes`} value={stage.notes ?? ""} onChange={(event) => updateStage(stage.id, { notes: event.target.value || null })} />
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${stage.stage}`} onClick={() => setStages((current) => current.filter((item) => item.id !== stage.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={working}>
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save tracking details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
