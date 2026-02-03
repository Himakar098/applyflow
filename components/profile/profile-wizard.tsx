"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileUp, ListChecks, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import { ProfileEditor } from "@/components/profile/profile-editor";

type ProfileWizardProps = {
  initialProfileText?: string;
  onSaved?: (profile: unknown) => void;
};

type ProfileReadiness = {
  ready: boolean;
  missing: string[];
  score: number;
};

function evaluateReadiness(profile: Record<string, unknown>): ProfileReadiness {
  const p = profile as any;
  const missing: string[] = [];
  let score = 0;

  const name = p?.contact?.name ?? p?.name;
  const email = p?.contact?.email ?? p?.email;
  const phone = p?.contact?.phone ?? p?.phone;
  const targetRoles = Array.isArray(p?.targetRoles) ? p.targetRoles : [];
  const projects = Array.isArray(p?.projects) ? p.projects : [];
  const workExperience = Array.isArray(p?.workExperience)
    ? p.workExperience
    : Array.isArray(p?.experience)
      ? p.experience
      : [];
  const skills = p?.skills;

  if (!name) missing.push("name");
  else score += 10;
  if (!email && !phone) missing.push("email or phone");
  else score += 10;
  if (!targetRoles.length) missing.push("target roles");
  else score += 20;

  if (projects.length < 2) {
    missing.push("at least 2 projects");
  } else {
    score += 20;
  }

  const hasExperience =
    Array.isArray(workExperience) &&
    workExperience.some((exp) => exp?.role || exp?.title);
  if (!hasExperience) {
    missing.push("work experience");
  } else {
    score += 20;
  }

  const hasSkillsObject =
    skills &&
    typeof skills === "object" &&
    (skills.languages?.length ||
      skills.tools?.length ||
      skills.cloud?.length ||
      skills.databases?.length);
  if (!hasSkillsObject) {
    missing.push("skills (grouped)");
  } else {
    score += 20;
  }

  return { ready: missing.length === 0, missing, score };
}

export function ProfileWizard({ initialProfileText = "", onSaved }: ProfileWizardProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [profileText, setProfileText] = useState<string>(initialProfileText);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeProgress, setResumeProgress] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
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
    void loadAiStatus();
  }, []);

  const readiness = useMemo(() => {
    try {
      const parsed = JSON.parse(profileText || "{}");
      return evaluateReadiness(parsed);
    } catch {
      return { ready: false, missing: ["valid JSON"], score: 0 };
    }
  }, [profileText]);

  const fillFromExtract = () => {
    try {
      const parsed = JSON.parse(profileText || "{}") as any;
      const enriched = { ...parsed };

      if (!Array.isArray(enriched.targetRoles)) {
        const headline = (enriched.headline || "").toString();
        enriched.targetRoles = headline ? [headline] : [];
      }

      if (!Array.isArray(enriched.preferredLocations)) {
        enriched.preferredLocations = enriched.contact?.location ? [enriched.contact.location] : [];
      }

      if (!enriched.yearsExperienceApprox && Array.isArray(enriched.workExperience)) {
        enriched.yearsExperienceApprox = enriched.workExperience.length;
      }

      if (!enriched.skills || typeof enriched.skills !== "object") {
        if (Array.isArray(enriched.skills)) {
          enriched.skills = { tools: enriched.skills, languages: [], cloud: [], databases: [] };
        } else {
          enriched.skills = { tools: [], languages: [], cloud: [], databases: [] };
        }
      }

      if (!Array.isArray(enriched.workExperience) && Array.isArray(enriched.experience)) {
        enriched.workExperience = enriched.experience.map((exp: any) => ({
          company: exp.company,
          role: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          bullets: exp.achievements ?? [],
          tools: exp.tools ?? [],
        }));
      }

      if (!Array.isArray(enriched.projects)) {
        enriched.projects = [];
      }

      setProfileText(JSON.stringify(enriched, null, 2));
      toast({ title: "Filled missing fields", description: "Seeded from resume extract." });
    } catch {
      toast({ title: "Invalid JSON", description: "Fix JSON before auto-filling.", variant: "destructive" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setFile(selected ?? null);
    setResumeProgress(selected ? 20 : 0);
  };

  const extractProfile = async () => {
    if (!file) {
      toast({ title: "Select a resume", description: "Upload PDF or DOCX.", variant: "destructive" });
      return;
    }
    if (!aiEnabled) {
      toast({
        title: "AI not configured",
        description: "Ask an admin to set OPENAI_API_KEY to enable extraction.",
        variant: "destructive",
      });
      return;
    }
    const headers = await getAuthHeader();
    if (!headers) {
      toast({ title: "Sign in required", description: "Please sign in again.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResumeProgress(40);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/profile/extract", {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to extract profile");
      }
      setResumeProgress(90);
      setProfileText(JSON.stringify(data.profileJson ?? {}, null, 2));
      toast({ title: "Profile extracted", description: "Review and finalize edits." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extract failed";
      const description =
        message === "AI_NOT_CONFIGURED"
          ? "AI features are disabled until an OpenAI key is configured."
          : message === "RESUME_EXTRACT_FAILED"
            ? "We couldn’t read text from this file. Try a text-based PDF (not scanned images)."
            : message;
      toast({ title: "Extract failed", description, variant: "destructive" });
    } finally {
      setLoading(false);
      setResumeProgress(0);
    }
  };

  const saveProfile = async () => {
    const headers = await getAuthHeader();
    if (!headers) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(profileText || "{}");
    } catch {
      toast({ title: "Invalid JSON", description: "Fix JSON before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/save", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ profileJson: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save profile");
      }
      toast({ title: "Profile saved" });
      onSaved?.(parsed);
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
          <CardTitle>Profile wizard</CardTitle>
          <CardDescription>Upload, extract, edit, and validate your profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!aiEnabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              AI extraction is disabled until an OpenAI key is configured. You can still build your profile manually.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileUp className="h-4 w-4 text-primary" />
                Step 1 — Upload resume
              </div>
              <Label htmlFor="resume-upload">Resume (PDF or DOCX)</Label>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="text-sm"
              />
              {resumeProgress > 0 ? (
                <Progress value={resumeProgress} className="h-2" />
              ) : null}
              <Button onClick={extractProfile} disabled={loading || !aiEnabled} className="mt-2">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Extract profile
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Steps 3 & 4 — Edit and validate
              </div>
              <p className="text-sm text-muted-foreground">
                Once extracted, edit the JSON and save. We’ll check readiness before tailoring.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-primary" />
              Readiness checklist
              {readiness.ready ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready to tailor
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  <TriangleAlert className="h-4 w-4" />
                  Not ready
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">Score: {readiness.score}/100</span>
              <Button size="sm" variant="outline" onClick={fillFromExtract}>
                Fill from resume extract
              </Button>
            </div>
            <ul className="space-y-1 text-sm">
              {["name", "email or phone", "target roles", "at least 2 projects", "work experience", "skills (grouped)"].map((item) => {
                const missing = readiness.missing.includes(item);
                return (
                  <li
                    key={item}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    {missing ? (
                      <TriangleAlert className="h-4 w-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                    <span className={missing ? "text-amber-700" : "text-emerald-700"}>
                      {item}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ProfileEditor value={profileText} onChange={setProfileText} />
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
