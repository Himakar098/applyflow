"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Link2, Loader2, TextCursorInput } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { jobAgentRequest, unwrapList, type JobAgentJob } from "@/lib/job-agent/client";

type ImportMode = "paste" | "url" | "csv";

export function JobImportForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<ImportMode>("paste");
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body =
        mode === "paste"
          ? {
              type: "paste",
              description,
              title: title || undefined,
              company: company || undefined,
              location: location || undefined,
              applicationUrl: applicationUrl || undefined,
            }
          : mode === "url"
            ? { type: "url", url }
            : { type: "csv", csv };
      const payload = await jobAgentRequest<unknown>("/api/job-agent/jobs/import", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const jobs = unwrapList<JobAgentJob>(payload, ["jobs"]);
      toast({
        title: jobs.length === 1 ? "Job imported and assessed" : `${jobs.length} jobs imported`,
        description: "Eligibility rules were applied before fit scoring.",
      });
      router.push(jobs[0]?.id ? `/jobs/${jobs[0].id}` : "/jobs");
    } catch (submitError) {
      toast({
        title: "Import failed",
        description: submitError instanceof Error ? submitError.message : "Check the job input and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    { id: "paste" as const, label: "Paste description", icon: TextCursorInput },
    { id: "url" as const, label: "Public job URL", icon: Link2 },
    { id: "csv" as const, label: "CSV import", icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Job discovery"
        title="Import a role for eligibility and fit review."
        description="Use a pasted description, a public employer job URL, or CSV. LinkedIn, SEEK, and Indeed remain user-directed capture only; the agent never bypasses access controls."
      />
      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Job source</CardTitle>
          <CardDescription>The original description is preserved alongside structured fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Import method">
            {modes.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                variant={mode === id ? "default" : "outline"}
                onClick={() => setMode(id)}
                role="tab"
                aria-selected={mode === id}
              >
                <Icon className="mr-2 h-4 w-4" /> {label}
              </Button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "paste" ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Title (optional)</Label>
                    <Input id="job-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-company">Company (optional)</Label>
                    <Input id="job-company" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={160} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-location">Location (optional)</Label>
                    <Input id="job-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-application-url">Application URL (optional)</Label>
                  <Input
                    id="job-application-url"
                    type="url"
                    value={applicationUrl}
                    onChange={(event) => setApplicationUrl(event.target.value)}
                    placeholder="http://127.0.0.1:3000/job-agent-fixtures/generic.html"
                    maxLength={2_000}
                  />
                  <p className="text-xs text-muted-foreground">Use the employer portal URL or the local mock portal when testing the supervised flow.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-description">Job description</Label>
                  <Textarea
                    id="job-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                    minLength={80}
                    maxLength={120_000}
                    className="min-h-80 font-mono text-xs"
                    placeholder="Paste the complete role description, including work-right and mandatory requirements."
                  />
                </div>
              </>
            ) : null}

            {mode === "url" ? (
              <div className="space-y-2">
                <Label htmlFor="job-url">Public employer job URL</Label>
                <Input
                  id="job-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://company.example/careers/role"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Initial full support covers public Greenhouse, Lever, and generic employer pages.
                </p>
              </div>
            ) : null}

            {mode === "csv" ? (
              <div className="space-y-2">
                <Label htmlFor="job-csv">CSV content</Label>
                <Textarea
                  id="job-csv"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  required
                  className="min-h-72 font-mono text-xs"
                  placeholder={'company,title,description,location,sourceUrl\n"Example Co","Data Analyst","Full job description...","Perth, WA","https://..."'}
                />
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import and assess
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
