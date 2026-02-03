"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { createJob as createJobAction } from "@/app/actions/jobs";
import { useAuth } from "@/lib/auth/auth-provider";
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
      setResults(nextPage === 1 ? data.results || [] : [...results, ...(data.results || [])]);
      setPage(nextPage);
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
        status: "applied",
        jobDescription: result.snippet || "",
        jobUrl: result.sourceUrl || "",
        applicationUrl: "",
        notes: "",
        appliedDate: "",
        followUpDate: "",
      };
      await createJobAction(idToken, payload);
      toast({ title: "Saved to tracker" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Search</p>
        <h2 className="text-2xl font-semibold text-foreground">Find jobs to apply</h2>
        <p className="text-sm text-muted-foreground">Search, save to tracker, and generate an application pack.</p>
      </div>

      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
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

      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
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
                <div key={`${job.title}-${idx}`} className="rounded-xl border p-4">
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
