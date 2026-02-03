"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import { trackGamificationEvent } from "@/lib/gamification/client";

type JobItem = {
  id: string;
  title?: string;
  company?: string;
  location?: string;
  source?: string;
  status?: string;
  appliedDate?: string;
  followUpDate?: string;
  jobDescription?: string;
  notes?: string;
  jobUrl?: string;
  applicationUrl?: string;
  checklist?: Record<string, boolean>;
};

export default function JobWorkspacePage({ params }: { params: { jobId: string } }) {
  const { toast } = useToast();
  const router = useRouter();
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [jdKeywords, setJdKeywords] = useState<string[]>([]);
  const [jdMustHave, setJdMustHave] = useState<string[]>([]);
  const [jdNiceToHave, setJdNiceToHave] = useState<string[]>([]);
  const [jdTechStack, setJdTechStack] = useState<string[]>([]);
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [aiEnabled, setAiEnabled] = useState(true);
  const [parsingJd, setParsingJd] = useState(false);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  const checklistItems = useMemo(
    () => [
      "Review tailored bullets",
      "Review cover letter",
      "Save PDF/DOCX exports",
      "Open application page",
      "Fill form fields manually",
      "Submit application",
      "Update status in tracker",
      "Set follow-up reminder date",
    ],
    [],
  );

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
    const loadProfile = async () => {
      try {
        const headers = await getAuthHeader();
        if (!headers) return;
        const res = await fetch("/api/profile/current", { headers });
        if (!res.ok) return;
        const data = await res.json();
        const profileJson = data.profileJson ?? {};
        const contact = profileJson?.contact ?? {};
        const links = profileJson?.links ?? {};
        setProfileFields({
          name: profileJson.fullName || contact.name || "",
          email: profileJson.email || contact.email || "",
          phone: profileJson.phone || contact.phone || "",
          location: profileJson.location || contact.location || "",
          linkedin: profileJson.linkedin || links.linkedin || "",
          github: profileJson.github || links.github || "",
          portfolio: profileJson.portfolio || links.portfolio || "",
        });
      } catch {
        // ignore
      }
    };
    const loadAiStatus = async () => {
      try {
        const headers = await getAuthHeader();
        if (!headers) return;
        const res = await fetch("/api/ai/status", { headers });
        if (res.ok) {
          const data = await res.json();
          setAiEnabled(Boolean(data.enabled));
        }
      } catch {
        // ignore
      }
    };
    const parseJd = async () => {
      try {
        const headers = await getAuthHeader();
        if (!headers || !jobId) return;
        const jd = job?.jobDescription || job?.notes || "";
        if (!jd) return;
        setParsingJd(true);
        const res = await fetch("/api/jobs/parse", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ jobText: jd }),
        });
        if (!res.ok) return;
        const parsed = await res.json();
        setJdKeywords(parsed.keywords || []);
        setJdTechStack(parsed.techStack || []);
        setJdMustHave(parsed.requirements?.mustHave || []);
        setJdNiceToHave(parsed.requirements?.niceToHave || []);
      } catch {
        // ignore
      } finally {
        setParsingJd(false);
      }
    };
    void loadProfile();
    void loadAiStatus();
    void parseJd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.jobDescription]);

  useEffect(() => {
    if (!job) return;
    const existing = job.checklist ?? {};
    const initial: Record<string, boolean> = {};
    checklistItems.forEach((item) => {
      initial[item] = Boolean(existing[item]);
    });
    setChecklistState(initial);
  }, [job, checklistItems]);

  const toggleChecklist = async (item: string) => {
    const previous = { ...checklistState };
    const next = { ...checklistState, [item]: !checklistState[item] };
    setChecklistState(next);

    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: next }),
      });
    } catch (error) {
      setChecklistState(previous);
      const message = error instanceof Error ? error.message : "Unable to save checklist";
      toast({ title: "Checklist save failed", description: message, variant: "destructive" });
    }

    const nextCompleted = checklistItems.filter((check) => next[check]).length;
    const prevCompleted = checklistItems.filter((check) => previous[check]).length;
    if (nextCompleted === checklistItems.length && prevCompleted < checklistItems.length) {
      await trackGamificationEvent("apply_checklist_complete", jobId);
    }
  };

  const completedCount = checklistItems.filter((item) => checklistState[item]).length;
  const progress = Math.round((completedCount / checklistItems.length) * 100);

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

  const openApplicationUrl = () => {
    if (!job) return;
    const url = job.applicationUrl || job.jobUrl;
    if (!url) {
      toast({ title: "No application URL", description: "Add an application URL in the job tracker.", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const generate = async () => {
    if (!job) return;
    if (!aiEnabled) {
      toast({
        title: "AI not configured",
        description: "Ask an admin to set OPENAI_API_KEY to enable generation.",
        variant: "destructive",
      });
      return;
    }
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
      const description =
        message === "AI_NOT_CONFIGURED"
          ? "AI features are disabled until an OpenAI key is configured."
          : message;
      toast({ title: "Generation failed", description, variant: "destructive" });
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
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Job workspace
            </p>
            <h2 className="text-3xl font-semibold text-foreground">
              {job.title} @ {job.company}
            </h2>
            <p className="text-sm text-muted-foreground">
              Status: {job.status || "—"} • Source: {job.source || "—"} • Location: {job.location || "—"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Apply progress</p>
              <p className="text-lg font-semibold text-foreground">{progress}%</p>
              <Progress value={progress} className="mt-2 h-2" />
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Tasks done</p>
              <p className="text-lg font-semibold text-foreground">{completedCount}/{checklistItems.length}</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Output ready</p>
              <p className="text-lg font-semibold text-foreground">
                {bullets.length || coverLetter ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/tailor?jobId=${job.id}`)}>
            Open in Tailor
          </Button>
          <Button variant="outline" onClick={openApplicationUrl}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Application Page
          </Button>
          <Button onClick={generate} disabled={genLoading || !aiEnabled || !job.jobDescription}>
            <Sparkles className="mr-2 h-4 w-4" />
            {genLoading ? "Generating..." : "Generate tailored pack"}
          </Button>
        </div>
      </div>
      {!aiEnabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          AI features are disabled until an OpenAI key is configured.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
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
            {!job.jobDescription && !job.notes ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Add a JD in the Job Tracker to unlock keyword parsing and tailored generation.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Application details</CardTitle>
            <CardDescription>Quick metadata for this job.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Applied: {job.appliedDate ? new Date(job.appliedDate).toLocaleDateString() : "—"}</p>
            <p>Follow-up: {job.followUpDate ? new Date(job.followUpDate).toLocaleDateString() : "—"}</p>
            <p>Source: {job.source || "—"}</p>
            <p>Status: {job.status || "—"}</p>
            <p>Location: {job.location || "—"}</p>
            <p>
              Listing URL: {job.jobUrl ? (
                <a className="text-primary underline-offset-4 hover:underline" href={job.jobUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : "—"}
            </p>
            <p>
              Application URL: {job.applicationUrl ? (
                <a className="text-primary underline-offset-4 hover:underline" href={job.applicationUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : "—"}
            </p>
            {job.notes ? <p className="text-foreground">Notes: {job.notes}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Requirements & keywords</CardTitle>
            <CardDescription>Parsed from the JD for quick reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {parsingJd ? (
              <p className="text-xs text-muted-foreground">Parsing JD…</p>
            ) : null}
            <div>
              <p className="font-semibold">Keywords</p>
              <p className="text-muted-foreground">{jdKeywords.length ? jdKeywords.join(", ") : "—"}</p>
            </div>
            <div>
              <p className="font-semibold">Tech stack</p>
              <p className="text-muted-foreground">{jdTechStack.length ? jdTechStack.join(", ") : "—"}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="font-semibold">Must-have</p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {(jdMustHave.length ? jdMustHave : ["—"]).map((item, idx) => (
                    <li key={`must-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold">Nice-to-have</p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {(jdNiceToHave.length ? jdNiceToHave : ["—"]).map((item, idx) => (
                    <li key={`nice-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Application data helper</CardTitle>
            <CardDescription>Quick copy fields for forms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.values(profileFields).every((val) => !val) ? (
              <p className="text-xs text-muted-foreground">
                Add contact fields to your profile to enable quick copy.
              </p>
            ) : null}
            {Object.entries(profileFields).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="capitalize text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="truncate text-foreground">{value || "—"}</span>
                  {value ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(value)}
                    >
                      Copy
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Guided apply checklist</CardTitle>
          <CardDescription>Complete these steps before submitting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          {checklistItems.map((item) => (
            <label key={item} className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2">
              <input
                type="checkbox"
                name={item}
                className="h-4 w-4"
                checked={Boolean(checklistState[item])}
                onChange={() => toggleChecklist(item)}
              />
              {item}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-card">
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
            {!bullets.length ? (
              <p className="text-xs text-muted-foreground">
                Generate a tailored pack or paste your own bullets.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Cover letter</p>
            <Textarea
              className="min-h-[220px] text-sm"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
            {!coverLetter ? (
              <p className="text-xs text-muted-foreground">
                Generate a tailored pack or paste a draft.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
