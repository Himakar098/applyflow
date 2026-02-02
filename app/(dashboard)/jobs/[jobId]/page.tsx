"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type JobItem = {
  id: string;
  title?: string;
  company?: string;
  location?: string;
  source?: string;
  status?: string;
  appliedDate?: string;
  jobDescription?: string;
  notes?: string;
};

type GenerationOutput = { resumeBullets: string[]; coverLetter: string };

export default function JobWorkspacePage({ params }: { params: { jobId: string } }) {
  const { toast } = useToast();
  const router = useRouter();
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");

  const jobId = params.jobId;

  const fetchJob = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        router.replace("/login");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/jobs/${jobId}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load job");
      setJob(data.item);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load job";
      toast({ title: "Job load failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestGeneration = async () => {
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const res = await fetch(`/api/generations/by-job?jobId=${jobId}`, { headers });
      const data = await res.json();
      if (!res.ok || !data.item?.output) return;
      setBullets(data.item.output.resumeBullets || []);
      setCoverLetter(data.item.output.coverLetter || "");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void fetchJob();
    void fetchLatestGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const exportPack = () => {
    const content = [
      "Resume Bullets:",
      bullets.join("\n"),
      "",
      "Cover Letter:",
      coverLetter,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "application_pack.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const generate = async () => {
    if (!job) return;
    const jd = job.jobDescription || job.notes || "";
    if (!job.title || !job.company || !jd) {
      toast({
        title: "Missing fields",
        description: "Ensure job title, company, and JD are filled before generating.",
        variant: "destructive",
      });
      return;
    }
    setGenLoading(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/generate/tailored-pack", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          jobTitle: job.title,
          company: job.company,
          jobDescription: jd,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.output) throw new Error(data.error || "Generation failed");
      setBullets(data.output.resumeBullets || []);
      setCoverLetter(data.output.coverLetter || "");
      toast({ title: "Tailored pack generated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      setGenLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (!job) {
    return <p className="text-sm text-muted-foreground">Job not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Job workspace
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            {job.title} @ {job.company}
          </h2>
          <p className="text-sm text-muted-foreground">
            Status: {job.status || "—"} • Source: {job.source || "—"} • Location: {job.location || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/tailor?jobId=${job.id}`)}>
            Open in Tailor
          </Button>
          <Button onClick={generate} disabled={genLoading}>
            <Sparkles className="mr-2 h-4 w-4" />
            {genLoading ? "Generating..." : "Generate tailored pack"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader>
            <CardTitle>Job description</CardTitle>
            <CardDescription>Reference JD for this application.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              className="min-h-[220px] text-sm"
              value={job.jobDescription || job.notes || "No job description provided."}
            />
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader>
            <CardTitle>Application details</CardTitle>
            <CardDescription>Quick metadata for this job.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Applied: {job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : "—"}</p>
            <p>Source: {job.source || "—"}</p>
            <p>Status: {job.status || "—"}</p>
            <p>Location: {job.location || "—"}</p>
            {job.notes ? <p className="text-foreground">Notes: {job.notes}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tailored output</CardTitle>
            <CardDescription>Review and edit before exporting.</CardDescription>
          </div>
          <Button variant="outline" onClick={exportPack} disabled={!bullets.length && !coverLetter}>
            Export pack
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Resume bullets</p>
            <Textarea
              className="min-h-[220px] text-sm"
              value={bullets.join("\n")}
              onChange={(e) => setBullets(e.target.value.split("\n"))}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Cover letter</p>
            <Textarea
              className="min-h-[220px] text-sm"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
