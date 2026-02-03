"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { GenerationHistory, type GenerationItem } from "@/components/tailor/generation-history";
import { TailorWizard } from "@/components/tailor/tailor-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type GenerationsResponse = { ok: boolean; items?: GenerationItem[]; error?: string };

export default function TailorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [style, setStyle] = useState("ats");
  const [tone, setTone] = useState("formal");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [focusKeywords, setFocusKeywords] = useState<string[]>([]);
  const [profileJson, setProfileJson] = useState<Record<string, unknown> | null>(null);
  const [profileText, setProfileText] = useState("");
  const [compareItem, setCompareItem] = useState<GenerationItem | null>(null);
  const [importedJobId, setImportedJobId] = useState<string | null>(null);
  const [importedJobLabel, setImportedJobLabel] = useState<string | null>(null);
  const [ignoredJobId, setIgnoredJobId] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/generations", { headers });
      const data = (await res.json()) as GenerationsResponse;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Unable to load generations");
      setHistory(data.items ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load history";
      toast({ title: "History load failed", description: message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
    const loadProfile = async () => {
      try {
        const headers = await getAuthHeader();
        if (!headers) {
          router.replace("/login");
          return;
        }
        const res = await fetch("/api/profile/current", { headers });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setProfileJson(data.profileJson ?? null);
          const textBlob = `${JSON.stringify(data.profileJson ?? {})} ${data.resumeText ?? ""}`;
          setProfileText(textBlob);
        }
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
    void loadProfile();
    void loadAiStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const jobIdParam = searchParams.get("jobId");
    if (!jobIdParam || importedJobId || jobIdParam === ignoredJobId) return;
    const loadJob = async () => {
      try {
        const headers = await getAuthHeader();
        if (!headers) return;
        const res = await fetch(`/api/jobs/${jobIdParam}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load job");
        const item = data.item;
        if (!jobTitle) setJobTitle(item.title || "");
        if (!company) setCompany(item.company || "");
        if (!jobDescription) setJobDescription(item.jobDescription || item.description || item.notes || "");
        setImportedJobId(jobIdParam);
        setImportedJobLabel(`${item.title || "Job"} @ ${item.company || ""}`);
        setIgnoredJobId(null);
      } catch (error) {
        console.error(error);
      }
    };
    void loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, importedJobId, ignoredJobId]);

  const handleSelectHistory = (item: GenerationItem) => {
    setJobTitle(item.jobTitle || "");
    setCompany(item.company || "");
    setJobDescription(item.jobDescription || "");
    setStyle(item.style || "ats");
    setTone(item.tone || "formal");
    setKeywords(item.keywords || []);
    setFocusKeywords(item.focusKeywords || []);
    if (item.output) {
      setBullets(item.output.resumeBullets || []);
      setCoverLetter(item.output.coverLetter || "");
    }
    setCompareItem(null);
  };

  const handleRegenerate = async (item: GenerationItem) => {
    setJobTitle(item.jobTitle || "");
    setCompany(item.company || "");
    setJobDescription(item.jobDescription || "");
    setStyle(item.style || "ats");
    setTone(item.tone || "formal");
    setFocusKeywords(item.focusKeywords || []);
    const headers = await getAuthHeader();
    if (!headers) {
      router.replace("/login");
      return;
    }
    try {
      const res = await fetch("/api/generate/tailored-pack", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: item.jobTitle,
          company: item.company,
          jobDescription: item.jobDescription,
          style: item.style,
          tone: item.tone,
          focusKeywords: item.focusKeywords,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.output) throw new Error(data.error || "Regenerate failed");
      setBullets(data.output.resumeBullets || []);
      setCoverLetter(data.output.coverLetter || "");
      setKeywords(data.keywords || []);
      toast({ title: "Regenerated" });
      void fetchHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regeneration failed";
      const description =
        message === "AI_NOT_CONFIGURED"
          ? "AI features are disabled until an OpenAI key is configured."
          : message;
      toast({ title: "Regeneration failed", description, variant: "destructive" });
    }
  };

  const handleDuplicate = (item: GenerationItem) => {
    setJobTitle(item.jobTitle || "");
    setCompany(item.company || "");
    setJobDescription(item.jobDescription || "");
    setStyle(item.style || "ats");
    setTone(item.tone || "formal");
    setFocusKeywords(item.focusKeywords || []);
    setKeywords(item.keywords || []);
    toast({ title: "Inputs loaded", description: "Click Generate to refresh outputs." });
  };

  const handleCompare = (item: GenerationItem) => {
    setCompareItem(item);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader>
          <CardTitle>Job Copilot</CardTitle>
          <CardDescription>
            Paste or import a JD, generate/edit outputs, save versions, and manage history.
          </CardDescription>
          {!aiEnabled ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              AI features are disabled until an OpenAI key is configured. You can still save and edit outputs manually.
            </div>
          ) : null}
          {!profileJson ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No profile detected. Build your profile in Settings for higher-quality tailoring.
            </div>
          ) : null}
          {importedJobId ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Imported from Job Tracker</Badge>
              {importedJobLabel ? (
                <span className="text-xs text-muted-foreground">{importedJobLabel}</span>
              ) : null}
              <button
                type="button"
                className="text-xs text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setImportedJobId(null);
                  setImportedJobLabel(null);
                  setIgnoredJobId(searchParams.get("jobId"));
                }}
              >
                Clear import
              </button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <TailorWizard
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            company={company}
            setCompany={setCompany}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            bullets={bullets}
            setBullets={setBullets}
            coverLetter={coverLetter}
            setCoverLetter={setCoverLetter}
            style={style}
            setStyle={setStyle}
            tone={tone}
            setTone={setTone}
            keywords={keywords}
            setKeywords={setKeywords}
            focusKeywords={focusKeywords}
            setFocusKeywords={setFocusKeywords}
            jobId={importedJobId}
            profileJson={profileJson}
            profileText={profileText}
            aiEnabled={aiEnabled}
            onHistoryLoad={fetchHistory}
          />
          <GenerationHistory
            items={history}
            loading={loadingHistory}
            onSelect={handleSelectHistory}
            onRefresh={fetchHistory}
            onRegenerate={handleRegenerate}
            onCompare={handleCompare}
            onDuplicate={handleDuplicate}
            currentBullets={bullets}
            currentCoverLetter={coverLetter}
          />
          {loadingHistory ? <Skeleton className="h-12 w-full rounded-lg" /> : null}
          {compareItem ? (
            <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
              <CardHeader>
                <CardTitle>Compare with current</CardTitle>
                <CardDescription>
                  {compareItem.jobTitle} @ {compareItem.company}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold mb-2">Selected version</p>
                  <Textarea
                    className="min-h-[200px]"
                    readOnly
                    value={[
                      "Bullets:",
                      compareItem.output?.resumeBullets?.join("\n") ?? "",
                      "",
                      "Cover letter:",
                      compareItem.output?.coverLetter ?? "",
                    ].join("\n")}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Current editor</p>
                  <Textarea
                    className="min-h-[200px]"
                    readOnly
                    value={["Bullets:", bullets.join("\n"), "", "Cover letter:", coverLetter].join("\n")}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
