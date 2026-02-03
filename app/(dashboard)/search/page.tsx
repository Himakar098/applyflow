"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { createJob as createJobAction } from "@/app/actions/jobs";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchGamificationDaily, trackGamificationEvent, type GamificationMeta } from "@/lib/gamification/client";
import type { JobDraft } from "@/lib/types";

type SearchResult = {
  title: string;
  company: string;
  location: string;
  source: string;
  snippet: string;
  sourceUrl?: string;
  postedAt?: string;
};

export default function SearchPage() {
  const { token, refreshToken } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState("any");
  const [datePosted, setDatePosted] = useState("30");
  const [jobType, setJobType] = useState("any");
  const [jobUrl, setJobUrl] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchCount, setSearchCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [metaState, setMetaState] = useState<GamificationMeta | null>(null);

  const matchesRemote = (job: SearchResult, mode: string) => {
    if (mode === "any") return true;
    const haystack = `${job.location} ${job.snippet} ${job.title}`.toLowerCase();
    if (mode === "remote") return haystack.includes("remote");
    if (mode === "hybrid") return haystack.includes("hybrid");
    if (mode === "onsite") return haystack.includes("onsite") || haystack.includes("on-site");
    return true;
  };

  const matchesJobType = (job: SearchResult, type: string) => {
    if (type === "any") return true;
    const haystack = `${job.snippet} ${job.title}`.toLowerCase();
    if (type === "full-time") return haystack.includes("full-time") || haystack.includes("full time");
    if (type === "part-time") return haystack.includes("part-time") || haystack.includes("part time");
    if (type === "contract") return haystack.includes("contract");
    if (type === "internship") return haystack.includes("intern");
    return true;
  };

  const parsePostedDays = (postedAt?: string) => {
    if (!postedAt) return null;
    const text = postedAt.toLowerCase();
    if (text.includes("today")) return 0;
    if (text.includes("yesterday")) return 1;
    const dayMatch = text.match(/(\d+)\s*day/);
    if (dayMatch) return Number(dayMatch[1]);
    const hourMatch = text.match(/(\d+)\s*hour/);
    if (hourMatch) return 0;
    const weekMatch = text.match(/(\d+)\s*week/);
    if (weekMatch) return Number(weekMatch[1]) * 7;
    const monthMatch = text.match(/(\d+)\s*month/);
    if (monthMatch) return Number(monthMatch[1]) * 30;
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const date = new Date(isoMatch[1]);
      if (!Number.isNaN(date.getTime())) {
        const diffMs = Date.now() - date.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    }
    return null;
  };

  const matchesDatePosted = (job: SearchResult, range: string) => {
    const maxDays = Number(range);
    if (!Number.isFinite(maxDays)) return true;
    const days = parsePostedDays(job.postedAt);
    if (days === null) return true;
    return days <= maxDays;
  };

  const applyClientFilters = (items: SearchResult[]) =>
    items.filter(
      (job) =>
        matchesRemote(job, remote) &&
        matchesJobType(job, jobType) &&
        matchesDatePosted(job, datePosted),
    );

  useEffect(() => {
    const loadGamification = async () => {
      const state = await fetchGamificationDaily();
      if (!state) return;
      setMetaState(state.meta);
      setSearchCount(state.daily.events.searchRuns ?? 0);
      setSavedCount(state.daily.events.jobsSaved ?? 0);
    };
    void loadGamification();
  }, []);

  const search = async (nextPage = 1) => {
    setLoading(true);
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          location,
          remote,
          datePosted,
          jobType,
          jobUrl,
          page: nextPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const incoming = applyClientFilters(data.results || []);
      setResults((prev) => (nextPage === 1 ? incoming : [...prev, ...incoming]));
      setPage(nextPage);
      if (nextPage === 1) {
        const state = await trackGamificationEvent("search_run");
        if (state) {
          setMetaState(state.meta);
          setSearchCount(state.daily.events.searchRuns ?? 0);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed";
      toast({ title: "Search failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveJob = async (result: SearchResult) => {
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) return;
      const payload: JobDraft = {
        company: result.company || "Unknown",
        title: result.title || "Job",
        location: result.location || "",
        source: result.source || "Other",
        status: "saved",
        jobDescription: result.snippet || "",
        jobUrl: result.sourceUrl || "",
        applicationUrl: "",
        notes: "",
        appliedDate: "",
        followUpDate: "",
      };
      await createJobAction(idToken, payload);
      const state = await trackGamificationEvent("job_saved");
      if (state) {
        setMetaState(state.meta);
        setSavedCount(state.daily.events.jobsSaved ?? 0);
      }
      toast({ title: "Saved to tracker" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Search</p>
            <h2 className="text-3xl font-semibold text-foreground">Find roles that match fast.</h2>
            <p className="text-sm text-muted-foreground">
              Search, save to tracker, and unlock tailored packs with a single click.
            </p>
            {metaState ? (
              <div className="chip">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {metaState.streak} day streak
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Search runs</p>
              <p className="text-lg font-semibold text-foreground">{searchCount}</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Saved roles</p>
              <p className="text-lg font-semibold text-foreground">{savedCount}</p>
              <Progress value={Math.min(100, (savedCount / 3) * 100)} className="mt-2 h-2" />
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Matches found</p>
              <p className="text-lg font-semibold text-foreground">{results.length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Search criteria</CardTitle>
          <CardDescription>Use a provider (SerpAPI/Adzuna) or paste a job URL if not configured.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Role / Keywords</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product Manager" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sydney or Remote" />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-1">
            <Label>Job URL (fallback)</Label>
            <Input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://company.com/careers/..." />
          </div>
          <div className="space-y-2">
            <Label>Remote</Label>
            <Select value={remote} onValueChange={setRemote}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">Onsite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date posted</Label>
            <Select value={datePosted} onValueChange={setDatePosted}>
              <SelectTrigger>
                <SelectValue placeholder="30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Job type</Label>
            <Select value={jobType} onValueChange={setJobType}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => search(1)} disabled={loading || (!query && !jobUrl)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Save anything relevant to your tracker.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && results.length === 0 ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results yet. Run a search.</p>
          ) : (
            <div className="space-y-3">
              {results.map((job, idx) => (
                <div key={`${job.title}-${idx}`} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.company} • {job.location || "—"} • {job.source}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {job.sourceUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={job.sourceUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </a>
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => saveJob(job)}>
                        <Save className="mr-2 h-4 w-4" />
                        Save to tracker
                      </Button>
                    </div>
                  </div>
                  {job.snippet ? (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{job.snippet}</p>
                  ) : null}
                </div>
              ))}
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => search(page + 1)} disabled={loading}>
                  Load more
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
