"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, EyeOff, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type RecommendedJob = {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  source: string;
  matchScore: number;
  matchReasons: string[];
};

type RecommendationResponse = {
  ok: boolean;
  date?: string;
  strong?: RecommendedJob[];
  medium?: RecommendedJob[];
  items?: RecommendedJob[];
  savedIds?: string[];
  savedMap?: Record<string, string>;
  hiddenIds?: string[];
  error?: string;
  missing?: string[];
};

export default function RecommendationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecommendedJob[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [missingPrefs, setMissingPrefs] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);

  const strong = useMemo(() => items.filter((job) => job.matchScore >= 80), [items]);
  const medium = useMemo(
    () => items.filter((job) => job.matchScore >= 60 && job.matchScore < 80),
    [items],
  );

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const res = await fetch("/api/recommendations", { headers });
      const data = (await res.json()) as RecommendationResponse;
      if (res.status === 412) {
        setMissingPrefs(data.missing ?? []);
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Unable to load recommendations");
      setItems(data.items ?? []);
      setSavedIds(data.savedIds ?? []);
      setSavedMap(data.savedMap ?? {});
      setDate(data.date ?? null);
      setMissingPrefs([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load recommendations";
      toast({ title: "Recommendations unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveJob = async (job: RecommendedJob) => {
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const res = await fetch("/api/recommendations/save", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save job");
      setSavedIds((prev) => [...prev, job.id]);
      if (data.id) {
        setSavedMap((prev) => ({ ...prev, [job.id]: data.id }));
      }
      toast({ title: "Saved to Job Tracker" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  };

  const hideJob = async (jobId: string) => {
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const res = await fetch("/api/recommendations/hide", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error("Hide failed");
      setItems((prev) => prev.filter((job) => job.id !== jobId));
    } catch {
      toast({ title: "Unable to hide", variant: "destructive" });
    }
  };

  const renderJobCard = (job: RecommendedJob) => {
    const isSaved = savedIds.includes(job.id);
    const workspaceId = savedMap[job.id];
    return (
      <Card key={job.id} className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                {job.title} @ {job.company}
              </CardTitle>
              <CardDescription>{job.location || "Location not specified"}</CardDescription>
            </div>
            <Badge className="rounded-full bg-primary/10 text-primary">
              {job.matchScore} match
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            {job.matchReasons.map((reason) => (
              <p key={reason}>• {reason}</p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {isSaved && workspaceId ? (
              <Button asChild variant="outline">
                <Link href={`/jobs/${workspaceId}`}>
                  Open Job Workspace
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : isSaved ? (
              <Badge variant="outline">Saved</Badge>
            ) : (
              <Button onClick={() => saveJob(job)}>
                Save to Job Tracker
              </Button>
            )}
            {job.url ? (
              <Button variant="outline" asChild>
                <a href={job.url} target="_blank" rel="noreferrer">
                  Open source
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => hideJob(job.id)}>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Recommendations
          </p>
          <h2 className="text-2xl font-semibold text-foreground">
            Recommended for you
          </h2>
          <p className="text-sm text-muted-foreground">
            Curated roles based on your profile and preferences.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          {date ? `Updated ${date}` : "Updated daily"}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : missingPrefs.length ? (
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardHeader>
            <CardTitle>Set preferences to get recommendations</CardTitle>
            <CardDescription>
              We use your preferences to keep recommendations curated and relevant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5">
              {missingPrefs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Button asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No recommendations available right now. Check back tomorrow.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {strong.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Strong matches</h3>
              {strong.map(renderJobCard)}
            </div>
          ) : null}
          {medium.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Medium matches</h3>
              {medium.map(renderJobCard)}
            </div>
          ) : null}
          {!strong.length && !medium.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Other matches</h3>
              {items.map(renderJobCard)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
