"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, Download, Sparkles, Trash2, Upload } from "lucide-react";

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
  style: string;
  setStyle: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  keywords: string[];
  setKeywords: (v: string[]) => void;
  focusKeywords: string[];
  setFocusKeywords: (v: string[]) => void;
  jobId?: string | null;
  profileJson?: Record<string, unknown> | null;
  profileText?: string;
  aiEnabled?: boolean;
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
  style,
  setStyle,
  tone,
  setTone,
  keywords,
  setKeywords,
  focusKeywords,
  setFocusKeywords,
  jobId,
  profileJson,
  profileText = "",
  aiEnabled = true,
  onHistoryLoad,
}: TailorWizardProps) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualKeywords, setManualKeywords] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [jdKeywords, setJdKeywords] = useState<string[]>([]);
  const [jdTechStack, setJdTechStack] = useState<string[]>([]);
  const [jdMustHave, setJdMustHave] = useState<string[]>([]);
  const [jdNiceToHave, setJdNiceToHave] = useState<string[]>([]);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [userEditedCompany, setUserEditedCompany] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);

  const headersPromise = useMemo(() => getAuthHeader(), []);

  const hasProfile = Boolean(profileJson);
  const hasJD = Boolean(jobTitle && company && jobDescription);

  const profileBlob = useMemo(
    () => (profileText || JSON.stringify(profileJson || {})).toLowerCase(),
    [profileJson, profileText],
  );

  const dedupe = (vals: string[], limit = 30) => {
    const seen = new Set<string>();
    const out: string[] = [];
    vals.forEach((v) => {
      const clean = v.trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    });
    return out.slice(0, limit);
  };

  const deriveKeywords = (text: string, manual: string) => {
    const manualTokens = manual
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const knownTech = [
      "python",
      "javascript",
      "typescript",
      "react",
      "nextjs",
      "node",
      "sql",
      "postgres",
      "mysql",
      "aws",
      "gcp",
      "azure",
      "docker",
      "kubernetes",
      "figma",
      "ml",
      "ai",
    ];
    const stop = new Set([
      "with",
      "this",
      "that",
      "from",
      "which",
      "will",
      "about",
      "other",
      "have",
      "been",
      "their",
      "they",
      "your",
      "into",
      "than",
      "after",
      "before",
      "using",
      "use",
      "team",
      "role",
      "work",
      "you",
      "our",
      "and",
      "for",
      "the",
      "with",
      "like",
      "also",
      "such",
      "need",
    ]);
    const freq: Record<string, number> = {};
    text
      .toLowerCase()
      .split(/[^a-z0-9+.#-]+/g)
      .filter((w) => w.length >= 4 && !stop.has(w))
      .forEach((w) => {
        freq[w] = (freq[w] ?? 0) + 1;
      });
    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([w]) => w);

    const foundTech = knownTech.filter((t) => text.toLowerCase().includes(t.toLowerCase()));

    return dedupe([...manualTokens, ...foundTech, ...topWords], 30);
  };

  useEffect(() => {
    setKeywords(deriveKeywords(jobDescription, manualKeywords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobDescription, manualKeywords]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      if (!jobDescription.trim()) return;
      try {
        const headers = await headersPromise;
        if (!headers) return;
        setParseLoading(true);
        const res = await fetch("/api/jobs/parse", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ jobText: jobDescription }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Unable to parse JD");
        }
        setJdKeywords(data.keywords || []);
        setJdTechStack(data.techStack || []);
        setJdMustHave(data.requirements?.mustHave || []);
        setJdNiceToHave(data.requirements?.niceToHave || []);
        if (!userEditedTitle && data.roleTitleGuess) {
          setJobTitle(data.roleTitleGuess);
        }
        if (!userEditedCompany && data.companyGuess) {
          setCompany(data.companyGuess);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("JD parse failed", error);
      } finally {
        setParseLoading(false);
      }
    }, 600);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobDescription, userEditedTitle, userEditedCompany]);

  const focusInput = focusKeywords.join(", ");

  const updateFocusInput = (value: string) => {
    const parts = value
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 30);
    setFocusKeywords(parts);
  };

  const matchedKeywords = (text: string) => {
    const lower = text.toLowerCase();
    return keywords.filter((k) => lower.includes(k.toLowerCase()));
  };

  const detectRisks = (bullet: string) => {
    const flags: string[] = [];
    const lowerProfile = profileBlob;
    const lowerBullet = bullet.toLowerCase();

    // Numbers
    const nums = bullet.match(/\b\d[\d.,]*(?:k|m|%|)\b/gi) || [];
    nums.forEach((n) => {
      if (!lowerProfile.includes(n.toLowerCase())) {
        flags.push("new_number");
      }
    });

    // Entities (capitalized sequences)
    const entities = bullet.match(/(?:[A-Z][a-zA-Z0-9&'-]*\s+){1,}[A-Z][a-zA-Z0-9&'-]*/g) || [];
    entities.forEach((ent) => {
      if (!lowerProfile.includes(ent.toLowerCase())) {
        flags.push("new_entity");
      }
    });

    // Claim verbs
    const verbs = ["increased", "reduced", "delivered", "owned", "led", "managed"];
    verbs.forEach((v) => {
      if (lowerBullet.includes(v) && !lowerProfile.includes(v)) {
        flags.push("new_claim");
      }
    });

    return dedupe(flags, 10);
  };

  const addBulletRow = () => {
    setBullets([...bullets, ""]);
  };

  const removeBulletRow = (index: number) => {
    const next = [...bullets];
    next.splice(index, 1);
    setBullets(next);
  };

  const moveBullet = (index: number, direction: "up" | "down") => {
    const next = [...bullets];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setBullets(next);
  };

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

  const downloadPack = () => {
    const content = [
      "Resume Bullets:",
      bullets.join("\n"),
      "",
      "Cover Letter:",
      coverLetter,
    ].join("\n");
    downloadTxt(content, "application-pack.txt");
  };

  const tuneBullet = async (
    index: number,
    action: "tighten" | "add_metric" | "ats" | "leadership",
  ) => {
    if (!aiEnabled) {
      toast({
        title: "AI not configured",
        description: "Ask an admin to set OPENAI_API_KEY to enable bullet tuning.",
        variant: "destructive",
      });
      return;
    }
    const headers = await headersPromise;
    if (!headers) return;
    if (!profileJson) {
      toast({ title: "Profile required", description: "Save your profile first.", variant: "destructive" });
      return;
    }
    const target = bullets[index];
    if (!target) return;
    try {
      const res = await fetch("/api/generate/bullet", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          bullet: target,
          action,
          profileJson,
          jobKeywords: keywords,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to refine bullet");
      const updated = [...bullets];
      updated[index] = data.bullet;
      setBullets(updated);
      toast({ title: "Bullet updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refine failed";
      const description =
        message === "AI_NOT_CONFIGURED"
          ? "AI features are disabled until an OpenAI key is configured."
          : message;
      toast({ title: "Refine failed", description, variant: "destructive" });
    }
  };

  const generate = async () => {
    const headers = await headersPromise;
    if (!headers) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!aiEnabled) {
      toast({
        title: "AI not configured",
        description: "Ask an admin to set OPENAI_API_KEY to enable generation.",
        variant: "destructive",
      });
      return;
    }
    if (!profileJson) {
      toast({
        title: "Profile required",
        description: "Build your profile in Settings or upload a resume before generating.",
        variant: "destructive",
      });
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
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription,
          style,
          tone,
          focusKeywords,
          jobId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.output) {
        throw new Error(data.error || "Generation failed");
      }
      setBullets(data.output.resumeBullets || []);
      setCoverLetter(data.output.coverLetter || "");
      setKeywords(data.keywords || []);
      toast({ title: "Generated tailored pack" });
      await onHistoryLoad();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      const description =
        message === "AI_NOT_CONFIGURED"
          ? "AI features are disabled until an OpenAI key is configured."
          : message;
      toast({ title: "Generation failed", description, variant: "destructive" });
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
          style,
          tone,
          keywords,
          focusKeywords,
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
          {!hasProfile ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Build your profile in Settings (or upload a resume) before generating.
            </div>
          ) : null}
          {!aiEnabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              AI features are disabled until an OpenAI key is configured.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  setUserEditedTitle(true);
                }}
                placeholder="Product Manager"
              />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setUserEditedCompany(true);
                }}
                placeholder="Acme Corp"
              />
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ats">ATS</SelectItem>
                  <SelectItem value="impact">Impact</SelectItem>
                  <SelectItem value="leadership">Leadership</SelectItem>
                  <SelectItem value="entry">Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Focus keywords (comma separated)</Label>
              <Input
                value={focusInput}
                onChange={(e) => updateFocusInput(e.target.value)}
                placeholder="AI, product analytics, stakeholder"
              />
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
            {parseLoading ? (
              <p className="text-xs text-muted-foreground">Parsing JD...</p>
            ) : null}
            {!parseLoading && !jobDescription ? (
              <p className="text-xs text-muted-foreground">
                Paste a JD to auto-fill keywords, requirements, and role suggestions.
              </p>
            ) : null}
            {jdKeywords.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {jdKeywords.slice(0, 20).map((k) => (
                  <span key={k} className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                    {k}
                  </span>
                ))}
              </div>
            ) : null}
            {jdTechStack.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {jdTechStack.map((k) => (
                  <span key={k} className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                    {k}
                  </span>
                ))}
              </div>
            ) : null}
            {(jdMustHave.length || jdNiceToHave.length) ? (
              <details className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold">Requirements</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Must have</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {jdMustHave.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Nice to have</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {jdNiceToHave.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Keywords (comma-separated)</Label>
              <Input
                value={manualKeywords}
                onChange={(e) => setManualKeywords(e.target.value)}
                placeholder="python, experimentation, stakeholder, ai"
              />
              <p className="text-xs text-muted-foreground">
                We auto-derive keywords from the JD; override or add your own here.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Focus keywords (comma-separated)</Label>
              <Input
                value={focusInput}
                onChange={(e) => updateFocusInput(e.target.value)}
                placeholder="product analytics, roadmap, GTM"
              />
              <p className="text-xs text-muted-foreground">These are forced into generations.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={generate} disabled={generating || !aiEnabled}>
              <Sparkles className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate"}
            </Button>
            <Button variant="outline" onClick={saveGeneration} disabled={saving}>
              <Upload className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save version"}
            </Button>
            <Button variant="outline" onClick={downloadPack} disabled={!bullets.length && !coverLetter}>
              <Download className="mr-2 h-4 w-4" />
              Export pack
            </Button>
          </div>
          {!hasJD ? (
            <p className="text-xs text-muted-foreground">
              Fill job title, company, and JD before generating.
            </p>
          ) : null}
          {keywords.length ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {keywords.map((k) => (
                <span key={k} className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                  {k}
                </span>
              ))}
            </div>
          ) : null}
          {!aiEnabled ? (
            <p className="text-xs text-muted-foreground">
              You can still edit and save manual outputs.
            </p>
          ) : null}
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
          <CardContent className="space-y-3">
            {bullets.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                No bullets yet. Generate a pack or add your first bullet manually.
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={addBulletRow}>
                    Add first bullet
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {bullets.map((bullet, idx) => {
                  const matched = matchedKeywords(bullet);
                  const risks = detectRisks(bullet);
                  return (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Bullet {idx + 1}</span>
                          {risks.length ? (
                            <span
                              className="rounded-full bg-amber-50 px-2 py-1 text-amber-700"
                              title={`Flags: ${risks.join(", ")}`}
                            >
                              Hallucination risk
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => moveBullet(idx, "up")} disabled={idx === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveBullet(idx, "down")}
                            disabled={idx === bullets.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeBulletRow(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        className="text-sm"
                        value={bullet}
                        onChange={(e) => {
                          const updated = [...bullets];
                          updated[idx] = e.target.value;
                          setBullets(updated);
                        }}
                      />
                      <div className="flex flex-wrap gap-2 text-xs">
                        {matched.map((k) => (
                          <span key={k} className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                            {k}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => tuneBullet(idx, "tighten")} disabled={!aiEnabled}>
                          Tighten
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => tuneBullet(idx, "add_metric")} disabled={!aiEnabled}>
                          Add metric
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => tuneBullet(idx, "ats")} disabled={!aiEnabled}>
                          Make ATS
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => tuneBullet(idx, "leadership")} disabled={!aiEnabled}>
                          Leadership
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={addBulletRow}>
                  Add bullet
                </Button>
              </>
            )}
            <details className="border rounded-lg p-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced: edit raw</summary>
              <p className="text-xs text-muted-foreground">One bullet per line.</p>
              <Textarea
                className="mt-2 min-h-[160px] text-sm"
                value={bullets.join("\n")}
                onChange={(e) => setBullets(e.target.value.split("\n"))}
              />
            </details>
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
