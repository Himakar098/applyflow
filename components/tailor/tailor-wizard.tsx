"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, Download, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
type JobOption = { id: string; title: string; company: string; description: string };

type TailorWizardProps = {
  jobTitle: string;
  setJobTitle: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  bullets: string[];
  setBullets: (v: string[]) => void;
  coverLetter: string;
  setCoverLetter: (v: string) => void;
  onHistoryLoad: () => Promise<void>;
};

export function TailorWizard({
  jobTitle,
  setJobTitle,
  company,
  setCompany,
  jobDescription,
  setJobDescription,
  bullets,
  setBullets,
  coverLetter,
  setCoverLetter,
  onHistoryLoad,
}: TailorWizardProps) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const headersPromise = useMemo(() => getAuthHeader(), []);

  useEffect(() => {
    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const headers = await headersPromise;
        if (!headers) return;
        const res = await fetch("/api/jobs", { headers });
        const data = (await res.json()) as { items?: JobOption[] };
        if (res.ok && Array.isArray(data.items)) {
          setJobs(
            data.items.map((j) => ({
              id: j.id,
              title: j.title,
              company: j.company,
              description: j.description ?? "",
            })),
          );
        }
      } catch (error) {
        console.error("load jobs", error);
      } finally {
        setLoadingJobs(false);
      }
    };
    void loadJobs();
  }, [headersPromise]);

  const importJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setJobTitle(job.title || "");
    setCompany(job.company || "");
    setJobDescription(job.description || "");
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadTxt = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generate = async () => {
    const headers = await headersPromise;
    if (!headers) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!jobTitle || !company || !jobDescription) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/tailored-pack", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, company, jobDescription }),
      });
      const data = await res.json();
      if (!res.ok || !data.output) {
        throw new Error(data.error || "Generation failed");
      }
      setBullets(data.output.resumeBullets || []);
      setCoverLetter(data.output.coverLetter || "");
      toast({ title: "Generated tailored pack" });
      await onHistoryLoad();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneration = async () => {
    const headers = await headersPromise;
    if (!headers) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!jobTitle || !company || !jobDescription) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    if (!bullets.length && !coverLetter) {
      toast({ title: "Nothing to save", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/generations/save", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription,
          output: { resumeBullets: bullets, coverLetter },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast({ title: "Generation saved" });
      await onHistoryLoad();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader>
          <CardTitle>Tailor flow</CardTitle>
          <CardDescription>
            Import a JD or paste it, generate tailored bullets and a cover letter, then edit and save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Product Manager" />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label>Import from Jobs</Label>
              <Select onValueChange={importJob} disabled={loadingJobs || jobs.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingJobs ? "Loading..." : "Select a saved job"} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} @ {job.company}
                    </SelectItem>
                  ))}
                  {jobs.length === 0 ? <SelectItem value="none" disabled>No saved jobs</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Job description</Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[160px]"
              placeholder="Paste the JD here..."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={generate} disabled={generating}>
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate"}
            </Button>
            <Button variant="outline" onClick={saveGeneration} disabled={saving}>
              <Upload className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save version"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Resume bullets</CardTitle>
              <CardDescription>Editable, ATS-safe bullets.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(bullets.join("\n"))}
                disabled={!bullets.length}
              >
                <Clipboard className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadTxt(bullets.join("\n"), "resume-bullets.txt")}
                disabled={!bullets.length}
              >
                <Download className="mr-2 h-4 w-4" />
                TXT
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              className="min-h-[220px] text-sm"
              value={bullets.join("\n")}
              onChange={(e) => setBullets(e.target.value.split("\n").filter(Boolean))}
              placeholder="Generated bullets will appear here."
            />
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Cover letter</CardTitle>
              <CardDescription>Editable draft, keep concise.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyText(coverLetter)} disabled={!coverLetter}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadTxt(coverLetter, "cover-letter.txt")}
                disabled={!coverLetter}
              >
                <Download className="mr-2 h-4 w-4" />
                TXT
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              className="min-h-[220px] text-sm"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Generated cover letter will appear here."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
