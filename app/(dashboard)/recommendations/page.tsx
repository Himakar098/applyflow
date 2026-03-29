"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  EyeOff,
  Filter,
  Loader2,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTour } from "@/components/onboarding/page-tour";
import { useToast } from "@/hooks/use-toast";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import { trackGamificationEvent } from "@/lib/gamification/client";

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
  provider?: string;
  warning?: string;
  appliedRoles?: string[];
  appliedLocation?: string | null;
  appliedScope?: string | null;
  strong?: RecommendedJob[];
  medium?: RecommendedJob[];
  items?: RecommendedJob[];
  savedIds?: string[];
  savedMap?: Record<string, string>;
  hiddenIds?: string[];
  error?: string;
  missing?: string[];
};

function inferWorkMode(job: RecommendedJob) {
  const haystack = `${job.title} ${job.description ?? ""} ${job.location ?? ""}`.toLowerCase();
  if (haystack.includes("remote")) return "Remote";
  if (haystack.includes("hybrid")) return "Hybrid";
  if (haystack.includes("on-site") || haystack.includes("onsite")) return "Onsite";
  return null;
}

function getMatchTier(score: number) {
  if (score >= 85) return { label: "High fit", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (score >= 70) return { label: "Good fit", tone: "bg-primary/10 text-primary border-primary/20" };
  return { label: "Possible fit", tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

function truncateText(value?: string, max = 180) {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}...`;
}

export default function RecommendationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingApplyId, setStartingApplyId] = useState<string | null>(null);
  const [items, setItems] = useState<RecommendedJob[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [missingPrefs, setMissingPrefs] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedLocation, setAppliedLocation] = useState<string | null>(null);
  const [appliedScope, setAppliedScope] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [minScoreFilter, setMinScoreFilter] = useState("55");
  const [workModeFilter, setWorkModeFilter] = useState("any");
  const [locationFilter, setLocationFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");

  const resetFilters = () => {
    setMinScoreFilter("55");
    setWorkModeFilter("any");
    setLocationFilter("");
    setKeywordFilter("");
  };

  const filteredTopItems = useMemo(() => {
    let next = [...items];
    const minScore = Number(minScoreFilter);
    if (Number.isFinite(minScore)) {
      next = next.filter((job) => job.matchScore >= minScore);
    }
    if (workModeFilter !== "any") {
      next = next.filter((job) => {
        const haystack = `${job.title} ${job.description ?? ""} ${job.location ?? ""}`.toLowerCase();
        if (workModeFilter === "remote") return haystack.includes("remote");
        if (workModeFilter === "hybrid") return haystack.includes("hybrid");
        if (workModeFilter === "onsite") return haystack.includes("on-site") || haystack.includes("onsite");
        return true;
      });
    }
    if (locationFilter.trim()) {
      const needle = locationFilter.trim().toLowerCase();
      next = next.filter((job) => (job.location ?? "").toLowerCase().includes(needle));
    }
    if (keywordFilter.trim()) {
      const needle = keywordFilter.trim().toLowerCase();
      next = next.filter((job) =>
        `${job.title} ${job.company} ${job.description ?? ""}`.toLowerCase().includes(needle),
      );
    }
    return next.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
  }, [items, keywordFilter, locationFilter, minScoreFilter, workModeFilter]);
  const strong = useMemo(() => filteredTopItems.filter((job) => job.matchScore >= 80), [filteredTopItems]);
  const medium = useMemo(
    () => filteredTopItems.filter((job) => job.matchScore >= 60 && job.matchScore < 80),
    [filteredTopItems],
  );
  const savedCount = savedIds.length;
  const roleSummary = useMemo(() => {
    if (!appliedRoles.length) return null;
    const visible = appliedRoles.slice(0, 3).join(", ");
    const extra = appliedRoles.length > 3 ? ` +${appliedRoles.length - 3}` : "";
    return `${visible}${extra}`;
  }, [appliedRoles]);
  const scopeLabel = appliedScope
    ? `${appliedScope.charAt(0).toUpperCase()}${appliedScope.slice(1)}`
    : null;
  const activeFilterBadges = useMemo(() => {
    const badges: string[] = [];
    if (minScoreFilter !== "55") badges.push(`Match ${minScoreFilter}+`);
    if (workModeFilter !== "any") badges.push(`Mode ${workModeFilter}`);
    if (locationFilter.trim()) badges.push(`Location ${locationFilter.trim()}`);
    if (keywordFilter.trim()) badges.push(`Keyword ${keywordFilter.trim()}`);
    return badges;
  }, [keywordFilter, locationFilter, minScoreFilter, workModeFilter]);

  const loadRecommendations = async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) {
      setRefreshing(true);
    } else if (items.length === 0) {
      setLoading(true);
    }
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const url = opts?.refresh ? "/api/recommendations?refresh=1" : "/api/recommendations";
      const res = await fetch(url, { headers });
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
      setWarning(data.warning ?? null);
      setAppliedRoles(data.appliedRoles ?? []);
      setAppliedLocation(data.appliedLocation ?? null);
      setAppliedScope(data.appliedScope ?? null);
      setProvider(data.provider ?? null);
      setMissingPrefs([]);
      if (opts?.refresh) {
        await trackAnalyticsEvent("recommendation_refreshed", {
          provider: data.provider ?? null,
          itemCount: (data.items ?? []).length,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load recommendations";
      toast({ title: "Recommendations unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      await trackGamificationEvent("recommendation_saved");
      await trackAnalyticsEvent("recommendation_saved", {
        source: job.source,
        matchScore: job.matchScore,
      });
      toast({ title: "Saved to Job Tracker" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  };

  const startApplyAssistant = async (job: RecommendedJob) => {
    setStartingApplyId(job.id);
    try {
      let workspaceId = savedMap[job.id];
      const headers = await getAuthHeader();
      if (!headers) return;
      if (!workspaceId) {
        const res = await fetch("/api/recommendations/save", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ job }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to prepare apply assistant");
        workspaceId = data.id ?? "";
        setSavedIds((prev) => [...prev, job.id]);
        if (workspaceId) {
          setSavedMap((prev) => ({ ...prev, [job.id]: workspaceId }));
        }
        await trackGamificationEvent("recommendation_saved");
        await trackAnalyticsEvent("recommendation_saved", {
          source: job.source,
          matchScore: job.matchScore,
        });
      }

      if (!workspaceId) {
        throw new Error("Unable to open apply assistant");
      }

      router.push(`/jobs/${workspaceId}/apply-assistant?recId=${encodeURIComponent(job.id)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open apply assistant";
      toast({ title: "Apply assistant unavailable", description: message, variant: "destructive" });
    } finally {
      setStartingApplyId(null);
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
    const workMode = inferWorkMode(job);
    const matchTier = getMatchTier(job.matchScore);
    const shortDescription = truncateText(job.description, 220);
    const topReasons = job.matchReasons.slice(0, 3);

    return (
      <Card key={job.id} className="surface-card">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-lg leading-tight">
                {job.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{job.company}</span>
                </span>
                <span className="hidden text-slate-300 sm:inline">•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{job.location || "Location not specified"}</span>
                </span>
              </div>
            </div>
            <div className="shrink-0 space-y-2 text-right">
              <Badge className={`rounded-full border ${matchTier.tone}`}>
                {matchTier.label}
              </Badge>
              <p className="text-sm font-semibold text-foreground">{job.matchScore}% match</p>
            </div>
          </div>
          <div className="space-y-2">
            <Progress value={job.matchScore} className="h-2" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Source: {job.source}</Badge>
              {workMode ? <Badge variant="secondary">{workMode}</Badge> : null}
              {isSaved ? <Badge variant="secondary">Saved</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {shortDescription ? (
            <p className="text-sm text-muted-foreground">{shortDescription}</p>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Why this fits
            </p>
            <div className="flex flex-wrap gap-2">
              {topReasons.map((reason) => (
                <Badge key={reason} variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {isSaved && workspaceId ? (
              <>
                <Button onClick={() => startApplyAssistant(job)} disabled={startingApplyId === job.id}>
                  {startingApplyId === job.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    "Apply with assistant"
                  )}
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/jobs/${workspaceId}`}>
                    Open workspace
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : isSaved ? (
              <>
                <Button variant="secondary" onClick={() => startApplyAssistant(job)} disabled={startingApplyId === job.id}>
                  {startingApplyId === job.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    "Apply with assistant"
                  )}
                </Button>
                <Badge variant="outline">Saved</Badge>
              </>
            ) : (
              <>
                <Button onClick={() => saveJob(job)}>Save to tracker</Button>
                <Button variant="secondary" onClick={() => startApplyAssistant(job)} disabled={startingApplyId === job.id}>
                  {startingApplyId === job.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    "Apply with assistant"
                  )}
                </Button>
              </>
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
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Recommendations
            </p>
            <h2 className="text-3xl font-semibold text-foreground">Your strongest matches today.</h2>
            <p className="text-sm text-muted-foreground">
              We score jobs against your profile and explain why each role fits.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              {date ? `Updated ${date}` : "Updated daily"}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => void loadRecommendations({ refresh: true })}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh recommendations
                </>
              )}
            </Button>
            <div className="flex flex-wrap gap-2 pt-2">
              {provider ? (
                <Badge variant="secondary">Source: {provider}</Badge>
              ) : null}
              {scopeLabel ? (
                <Badge variant="secondary">Scope: {scopeLabel}</Badge>
              ) : null}
              {appliedLocation ? (
                <Badge variant="secondary">Location: {appliedLocation}</Badge>
              ) : null}
              {roleSummary ? (
                <Badge variant="secondary">Roles: {roleSummary}</Badge>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Strong matches</p>
              <p className="text-lg font-semibold text-foreground">{strong.length}</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Saved today</p>
              <p className="text-lg font-semibold text-foreground">{savedCount}</p>
              <Progress value={Math.min(100, (savedCount / 2) * 100)} className="mt-2 h-2" />
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Showing</p>
              <p className="text-lg font-semibold text-foreground">
                {filteredTopItems.length}/{Math.min(items.length, 10)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <PageTour
        storageKey="recommendations"
        userId={user?.uid}
        eyebrow="Recommendations tour"
        title="Use recommendations as your decision layer, not just another job list."
        description="Start with the highest-fit roles, use filters only when needed, and move strong roles into Apply Assistant or the tracker."
        badgeLabel="Quick path"
        steps={[
          {
            title: "Read the fit signal first",
            description: "Focus on match score, fit tier, and the “Why this fits” chips before opening external links.",
          },
          {
            title: "Filter without getting stuck",
            description: "Use minimum match, work mode, location, and keyword filters. Reset if the list gets too narrow.",
          },
          {
            title: "Save strong roles to your tracker",
            description: "Store roles you want to work on so the tracker becomes your single pipeline view.",
            href: "/jobs",
            ctaLabel: "Open tracker",
          },
          {
            title: "Use Apply Assistant for company sites",
            description: "For good matches on employer career pages, launch Apply Assistant instead of applying manually.",
            href: "/extensions",
            ctaLabel: "Extension setup",
          },
        ]}
      />

      <Card className="surface-card">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Active filters
            </CardTitle>
            <CardDescription>Top 10 profile matches after filters.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Showing {filteredTopItems.length} of {items.length}</Badge>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
            <Label>Minimum match</Label>
            <Select value={minScoreFilter} onValueChange={setMinScoreFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="55">55+</SelectItem>
                <SelectItem value="60">60+</SelectItem>
                <SelectItem value="70">70+</SelectItem>
                <SelectItem value="80">80+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Work mode</Label>
            <Select value={workModeFilter} onValueChange={setWorkModeFilter}>
              <SelectTrigger>
                <SelectValue />
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
            <Label>Location contains</Label>
            <Input
              placeholder="e.g., Perth"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Keyword</Label>
            <Input
              placeholder="e.g., analyst"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
            />
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilterBadges.length ? (
              activeFilterBadges.map((badge) => (
                <Badge key={badge} variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                  {badge}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No extra filters active. Showing broad top matches.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : missingPrefs.length ? (
        <Card className="surface-card">
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
        <Card className="surface-card">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {warning ?? "No recommendations available right now. Check back tomorrow."}
          </CardContent>
        </Card>
      ) : filteredTopItems.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="space-y-4 py-10 text-center text-sm text-muted-foreground">
            <p>No recommendations match your active filters. Relax filters to see more results.</p>
            <div className="flex justify-center">
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {warning ? (
            <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
              {warning} Add more target roles or preferred locations to widen the match pool.
            </div>
          ) : null}
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
              {filteredTopItems.map(renderJobCard)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
