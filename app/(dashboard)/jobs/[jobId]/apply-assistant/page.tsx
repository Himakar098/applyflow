"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Loader2, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";

import { updateJob as updateJobAction } from "@/app/actions/jobs";
import { PageTour } from "@/components/onboarding/page-tour";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { pingApplyFlowExtension, setApplyFlowExtensionContext } from "@/lib/extension-bridge/client";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import type { Profile } from "@/lib/types";

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
  jobUrl?: string;
  applicationUrl?: string;
};

type ResolveResponse = {
  ok: boolean;
  applyUrl?: string | null;
  candidates?: string[];
  confidence?: "high" | "medium" | "low";
  reason?: string;
  error?: string;
};

function detectAtsName(url: string | null) {
  if (!url) return "Generic";
  const lower = url.toLowerCase();
  if (lower.includes("amazon.jobs")) return "Amazon Careers";
  if (lower.includes("metacareers.com")) return "Meta Careers";
  if (lower.includes("riotinto")) return "Rio Tinto Careers";
  if (lower.includes("myworkdayjobs.com")) return "Workday";
  if (lower.includes("greenhouse.io")) return "Greenhouse";
  if (lower.includes("jobs.lever.co")) return "Lever";
  if (lower.includes("icims.com")) return "iCIMS";
  if (lower.includes("smartrecruiters.com")) return "SmartRecruiters";
  if (lower.includes("workable.com")) return "Workable";
  if (lower.includes("taleo.net") || lower.includes("careersection")) return "Taleo";
  if (lower.includes("governmentjobs.com") || lower.includes(".gov") || lower.includes(".gov.au")) {
    return "Government Portal";
  }
  if (lower.includes("successfactors.com") || lower.includes("jobs.sap.com")) {
    return "SuccessFactors";
  }
  return "Generic";
}

function buildExtensionContext(job: JobItem, profile: Profile | null, applyUrl: string | null, answerBank: Array<{ question: string; answer: string }>) {
  return {
    version: 1,
    source: "applyflow",
    createdAt: new Date().toISOString(),
    job: {
      id: job.id,
      title: job.title ?? "",
      company: job.company ?? "",
      location: job.location ?? "",
      source: job.source ?? "",
      listingUrl: job.jobUrl ?? "",
      applyUrl: applyUrl ?? job.applicationUrl ?? job.jobUrl ?? "",
    },
    profile: {
      fullName: profile?.fullName ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      location: profile?.location ?? "",
      linkedin: profile?.linkedin ?? "",
      github: profile?.github ?? "",
      portfolio: profile?.portfolio ?? "",
      visaStatus: profile?.visaStatus ?? "",
    },
    answers: answerBank,
  };
}

function buildAnswerBank(profile: Profile | null, job: JobItem | null) {
  const visa = profile?.visaStatus?.trim() || "Please confirm based on your profile";
  const exp = profile?.yearsExperienceApprox ? `${profile.yearsExperienceApprox}+ years` : "Relevant experience";
  const targetRole = profile?.targetRoles?.[0] || job?.title || "this role";
  const location = profile?.location || profile?.preferredLocationCity || profile?.preferredLocationCountry || "";
  const tools = [
    ...(profile?.skills?.languages ?? []),
    ...(profile?.skills?.tools ?? []),
    ...(profile?.skills?.cloud ?? []),
  ]
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");

  return [
    {
      question: "Why are you interested in this role?",
      answer: `I am excited about the ${job?.title || targetRole} opportunity at ${job?.company || "your company"} because it aligns with my recent work and long-term career direction. I enjoy solving business problems with clear outcomes and strong collaboration across teams.`,
    },
    {
      question: "What experience is most relevant?",
      answer: `I bring ${exp} aligned with ${targetRole}. I have delivered projects that required stakeholder management, analysis, and execution discipline${tools ? `. Tools/skills I use regularly: ${tools}.` : "."}`,
    },
    {
      question: "Work authorization / visa status",
      answer: visa,
    },
    {
      question: "Current location and relocation",
      answer: location
        ? `I am currently based in ${location}. I am open to discussing location and work mode requirements for this role.`
        : "I am open to discussing location and work mode requirements for this role.",
    },
    {
      question: "Notice period / start date",
      answer:
        "I can align my start date based on the hiring timeline and notice requirements. I am happy to discuss the earliest feasible start date during the interview process.",
    },
  ];
}

export default function ApplyAssistantPage({ params }: { params: { jobId: string } }) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, refreshToken, user } = useAuth();

  const recId = searchParams.get("recId");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobItem | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applyUrl, setApplyUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("low");
  const [resolveReason, setResolveReason] = useState("");
  const [confirmReview, setConfirmReview] = useState(false);
  const [confirmQuestions, setConfirmQuestions] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<"checking" | "connected" | "not_detected">("checking");
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionSyncState, setExtensionSyncState] = useState<"idle" | "syncing" | "synced" | "failed">("idle");
  const lastSyncedContextKey = useRef("");

  const answerBank = useMemo(() => buildAnswerBank(profile, job), [profile, job]);
  const atsName = useMemo(
    () => detectAtsName(applyUrl ?? job?.applicationUrl ?? job?.jobUrl ?? null),
    [applyUrl, job?.applicationUrl, job?.jobUrl],
  );
  const extensionContext = useMemo(
    () => (job ? buildExtensionContext(job, profile, applyUrl, answerBank) : null),
    [answerBank, applyUrl, job, profile],
  );
  const extensionContextKey = useMemo(
    () => (extensionContext ? JSON.stringify(extensionContext) : ""),
    [extensionContext],
  );

  const autofillFields = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Full name", value: profile.fullName ?? "" },
      { label: "Email", value: profile.email ?? "" },
      { label: "Phone", value: profile.phone ?? "" },
      { label: "Location", value: profile.location ?? "" },
      { label: "LinkedIn", value: profile.linkedin ?? "" },
      { label: "GitHub", value: profile.github ?? "" },
      { label: "Portfolio", value: profile.portfolio ?? "" },
      { label: "Visa status", value: profile.visaStatus ?? "" },
    ].filter((item) => item.value.trim().length > 0);
  }, [profile]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const copyExtensionContext = async () => {
    if (!extensionContext) return;
    await copyText(JSON.stringify(extensionContext, null, 2));
  };

  const checkExtensionStatus = useCallback(
    async (showFailureToast = false) => {
      setExtensionStatus("checking");
      try {
        const result = await pingApplyFlowExtension();
        if (!result.ok || !result.installed) {
          throw new Error(result.error || "extension_not_detected");
        }
        setExtensionStatus("connected");
        setExtensionVersion(result.version ?? null);
        return true;
      } catch {
        setExtensionStatus("not_detected");
        setExtensionVersion(null);
        setExtensionSyncState("idle");
        if (showFailureToast) {
          toast({
            title: "Extension not detected",
            description: "Install the ApplyFlow extension in this browser or use the copy fallback.",
            variant: "destructive",
          });
        }
        return false;
      }
    },
    [toast],
  );

  const syncContextToExtension = useCallback(
    async (showSuccessToast = true) => {
      if (!extensionContext || !extensionContextKey) return false;

      const connected = extensionStatus === "connected" || (await checkExtensionStatus(showSuccessToast));
      if (!connected) return false;

      setExtensionSyncState("syncing");
      try {
        const result = await setApplyFlowExtensionContext(extensionContext as Record<string, unknown>);
        if (!result.ok) {
          throw new Error(result.error || "Unable to sync extension context");
        }
        setExtensionSyncState("synced");
        lastSyncedContextKey.current = extensionContextKey;
        if (showSuccessToast) {
          toast({
            title: "Context synced",
            description: "Open the extension on the employer page and run autofill.",
          });
        }
        return true;
      } catch (error) {
        setExtensionSyncState("failed");
        if (showSuccessToast) {
          toast({
            title: "Unable to sync extension",
            description: error instanceof Error ? error.message : "Please use the copy fallback.",
            variant: "destructive",
          });
        }
        return false;
      }
    },
    [checkExtensionStatus, extensionContext, extensionContextKey, extensionStatus, toast],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        router.replace("/login");
        return;
      }

      const [jobRes, profileRes] = await Promise.all([
        fetch(`/api/jobs/${params.jobId}`, { headers }),
        fetch("/api/profile/current", { headers }),
      ]);

      const jobJson = (await jobRes.json()) as { item?: JobItem; error?: string };
      if (!jobRes.ok || !jobJson.item) {
        throw new Error(jobJson.error || "Unable to load job workspace");
      }

      setJob(jobJson.item);

      if (profileRes.ok) {
        const profileJson = (await profileRes.json()) as { profileJson?: Profile };
        setProfile(profileJson.profileJson ?? null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load apply assistant";
      toast({ title: "Apply assistant unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resolveUrl = async () => {
    if (!job?.title || !job.company) return;
    setResolving(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const response = await fetch("/api/apply-assistant/resolve", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location ?? "",
          sourceUrl: job.applicationUrl || job.jobUrl || "",
        }),
      });
      const data = (await response.json()) as ResolveResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to resolve application URL");
      }
      setApplyUrl(data.applyUrl ?? null);
      setCandidates(data.candidates ?? []);
      setConfidence(data.confidence ?? "low");
      setResolveReason(data.reason ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to resolve URL";
      toast({ title: "URL resolution failed", description: message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.jobId]);

  useEffect(() => {
    void checkExtensionStatus(false);
  }, [checkExtensionStatus]);

  useEffect(() => {
    if (!job) return;
    void resolveUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  useEffect(() => {
    if (extensionStatus !== "connected") return;
    if (!extensionContext || !extensionContextKey) return;
    if (lastSyncedContextKey.current === extensionContextKey) return;
    void syncContextToExtension(false);
  }, [extensionContext, extensionContextKey, extensionStatus, syncContextToExtension]);

  const submitFromAssistant = async () => {
    if (!job?.id) return;
    setSubmitting(true);
    try {
      const idToken = token ?? (await refreshToken());
      if (!idToken) throw new Error("Session expired. Please sign in again.");

      const now = new Date().toISOString();
      await updateJobAction(idToken, job.id, { status: "applied", appliedDate: now });

      const headers = await getAuthHeader();
      if (headers && recId) {
        await fetch("/api/recommendations/hide", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: recId }),
        });
      }

      await trackAnalyticsEvent("job_applied", {
        source: job.source ?? "apply_assistant",
        via: "apply_assistant",
      });
      if (recId) {
        await trackAnalyticsEvent("recommendation_applied", {
          source: job.source ?? "apply_assistant",
          via: "apply_assistant",
        });
      }

      toast({
        title: "Application marked as submitted",
        description: "Job status moved to Applied and recommendation was hidden.",
      });
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to finalize submission";
      toast({ title: "Submit confirmation failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
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
              Apply Assistant (Beta)
            </p>
            <h2 className="text-3xl font-semibold text-foreground">
              {job.title} @ {job.company}
            </h2>
            <p className="text-sm text-muted-foreground">
              We resolve the best application link, prepare autofill data, and wait for your final confirm before submit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Confidence: {confidence}</Badge>
            <Badge variant="secondary">ATS: {atsName}</Badge>
            {job.location ? <Badge variant="secondary">{job.location}</Badge> : null}
            {job.source ? <Badge variant="secondary">Source: {job.source}</Badge> : null}
          </div>
        </div>
      </div>

      <PageTour
        storageKey="apply-assistant"
        userId={user?.uid}
        eyebrow="Apply Assistant tour"
        title="Apply faster on company career pages without losing control."
        description="Resolve the right apply link, sync your context to the extension, review the employer form, then confirm back in ApplyFlow."
        badgeLabel={extensionStatus === "connected" ? "Extension connected" : "Extension recommended"}
        steps={[
          {
            title: "Refresh the application link",
            description: "If the current link looks wrong or stale, refresh it before you continue.",
          },
          {
            title: "Sync to the extension",
            description: "Use direct sync when the extension is installed in this browser. Copy JSON only if sync is unavailable.",
            href: "/extensions",
            ctaLabel: "Extension setup",
          },
          {
            title: "Complete the employer form",
            description: "Use the mini browser or open the employer site in a new tab if the page blocks embedding.",
          },
          {
            title: "Confirm after submit",
            description: "Once you actually submit on the employer site, mark the role as applied here so ApplyFlow stays accurate.",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Mini browser
            </CardTitle>
            <CardDescription>
              Embedded view can be blocked by company site security policies. Use “Open in new tab” if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void resolveUrl()} disabled={resolving}>
                {resolving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh apply link
                  </>
                )}
              </Button>
              {applyUrl ? (
                <Button asChild>
                  <a href={applyUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => void copyExtensionContext()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy extension context
              </Button>
              <Button
                variant="outline"
                onClick={() => void syncContextToExtension(true)}
                disabled={!extensionContext || extensionSyncState === "syncing"}
              >
                {extensionSyncState === "syncing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : extensionSyncState === "synced" ? (
                  "Sync again"
                ) : (
                  "Sync to extension"
                )}
              </Button>
              <Button variant="outline" onClick={() => void checkExtensionStatus(true)}>
                Check extension
              </Button>
              <Button asChild variant="outline">
                <Link href="/extensions">Install extension</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-white/60 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={extensionStatus === "connected" ? "default" : "secondary"}>
                  Extension: {extensionStatus === "connected" ? "Connected" : extensionStatus === "checking" ? "Checking..." : "Not detected"}
                </Badge>
                {extensionVersion ? <Badge variant="secondary">v{extensionVersion}</Badge> : null}
                {extensionSyncState === "synced" ? <Badge variant="secondary">Context synced</Badge> : null}
              </div>
              <p className="mt-2">
                {extensionStatus === "connected"
                  ? "This browser has the ApplyFlow extension. Sync the current job context, then start assisted autofill on the employer tab. If the site stops on login, CAPTCHA, or MFA, clear it there and the extension will resume on the same tab."
                  : extensionStatus === "checking"
                    ? "Checking whether the ApplyFlow extension is available in this browser."
                    : "Extension not detected in this browser. Install it, or use the copy fallback for manual paste."}
              </p>
            </div>

            {resolveReason ? (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {resolveReason}
              </div>
            ) : null}

            {applyUrl ? (
              <div className="overflow-hidden rounded-xl border border-white/60 bg-white">
                <iframe
                  title="Apply assistant browser"
                  src={applyUrl}
                  className="h-[560px] w-full"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No application URL resolved yet. Refresh the link or open the original listing:
                {" "}
                {job.jobUrl ? (
                  <a className="text-primary underline-offset-4 hover:underline" href={job.jobUrl} target="_blank" rel="noreferrer">
                    {job.jobUrl}
                  </a>
                ) : (
                  "missing listing URL"
                )}
              </div>
            )}

            {candidates.length > 1 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Candidate links</p>
                {candidates.slice(0, 4).map((candidate) => (
                  <a
                    key={candidate}
                    className="block truncate text-xs text-primary underline-offset-4 hover:underline"
                    href={candidate}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {candidate}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="rounded-xl border border-dashed border-white/60 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
              Recommended flow: sync context to the extension from this page, open the employer tab, then click
              {" "}
              <strong>Start assisted autofill</strong>
              {" "}
              in the Chrome, Edge, or Safari extension. If login, CAPTCHA, MFA, or another security step appears, complete it on that same tab and the extension will resume autofill automatically. Copy JSON is still available as fallback.
              {" "}
              Supported adapters: Amazon, Meta, Rio Tinto, Workday, Greenhouse, Lever, iCIMS, Taleo, SmartRecruiters, Workable, Government portals, SuccessFactors (+ generic fallback).
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Autofill kit</CardTitle>
              <CardDescription>Use these values to quickly complete required fields.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {autofillFields.length ? (
                autofillFields.map((field) => (
                  <div key={field.label} className="flex items-start justify-between gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">{field.label}</p>
                      <p className="truncate text-sm text-foreground">{field.value}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => void copyText(field.value)}>
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy {field.label}</span>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Missing profile details. Complete profile fields in
                  {" "}
                  <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
                    Settings
                  </Link>
                  .
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Question answer bank</CardTitle>
              <CardDescription>Editable starter answers for common application prompts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {answerBank.map((item) => (
                <div key={item.question} className="space-y-2 rounded-lg border border-white/60 bg-white/70 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{item.question}</p>
                  <Textarea value={item.answer} readOnly className="min-h-[88px] text-sm" />
                  <Button size="sm" variant="outline" onClick={() => void copyText(item.answer)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy answer
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="surface-card border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Final confirmation
              </CardTitle>
              <CardDescription>ApplyFlow does not auto-submit without your explicit confirmation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmReview}
                  onChange={(event) => setConfirmReview(event.target.checked)}
                />
                I reviewed profile fields and uploaded the correct resume.
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmQuestions}
                  onChange={(event) => setConfirmQuestions(event.target.checked)}
                />
                I reviewed and finalized answers for required questions.
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmSubmit}
                  onChange={(event) => setConfirmSubmit(event.target.checked)}
                />
                I have submitted (or I am submitting now) this application.
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => void submitFromAssistant()}
                  disabled={!confirmReview || !confirmQuestions || !confirmSubmit || submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm and mark as applied
                    </>
                  )}
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/jobs/${job.id}`}>Back to job workspace</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
