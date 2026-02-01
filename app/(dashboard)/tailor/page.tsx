"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { GenerationHistory, type GenerationItem } from "@/components/tailor/generation-history";
import { TailorWizard } from "@/components/tailor/tailor-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type GenerationsResponse = { ok: boolean; items?: GenerationItem[]; error?: string };

export default function TailorPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectHistory = (item: GenerationItem) => {
    setJobTitle(item.jobTitle || "");
    setCompany(item.company || "");
    setJobDescription(item.jobDescription || "");
    if (item.output) {
      setBullets(item.output.resumeBullets || []);
      setCoverLetter(item.output.coverLetter || "");
    }
  };

  const handleRegenerate = async (item: GenerationItem) => {
    setJobTitle(item.jobTitle || "");
    setCompany(item.company || "");
    setJobDescription(item.jobDescription || "");
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.output) throw new Error(data.error || "Regenerate failed");
      setBullets(data.output.resumeBullets || []);
      setCoverLetter(data.output.coverLetter || "");
      toast({ title: "Regenerated" });
      void fetchHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regeneration failed";
      toast({ title: "Regeneration failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader>
          <CardTitle>Job Copilot</CardTitle>
          <CardDescription>
            Paste or import a JD, generate/edit outputs, save versions, and manage history.
          </CardDescription>
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
            onHistoryLoad={fetchHistory}
          />
          <GenerationHistory
            items={history}
            loading={loadingHistory}
            onSelect={handleSelectHistory}
            onRefresh={fetchHistory}
            onRegenerate={handleRegenerate}
          />
          {loadingHistory ? <Skeleton className="h-12 w-full rounded-lg" /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
