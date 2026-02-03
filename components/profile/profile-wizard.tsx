"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import { ProfileBuilder } from "@/components/settings/profile-builder";
import { emptyProfile, normalizeProfile } from "@/lib/profile/normalize";
import type { Profile } from "@/lib/types";
import { fetchGamificationDaily, trackGamificationEvent } from "@/lib/gamification/client";

type ProfileWizardProps = {
  initialProfile?: Profile;
  onSaved?: (profile: Profile) => void;
};

type ProfileReadiness = {
  ready: boolean;
  missing: string[];
  score: number;
};

type ReadinessInput = {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  contact?: { name?: string; email?: string; phone?: string };
  targetRoles?: string[];
  projects?: unknown[];
  workExperience?: { role?: string; title?: string }[];
  experience?: { role?: string; title?: string }[];
  skills?: { languages?: string[]; tools?: string[]; cloud?: string[]; databases?: string[] };
};

function evaluateReadiness(profile: Record<string, unknown>): ProfileReadiness {
  const p = profile as ReadinessInput;
  const missing: string[] = [];
  let score = 0;

  const name = p?.fullName ?? p?.contact?.name ?? p?.name;
  const email = p?.email ?? p?.contact?.email;
  const phone = p?.phone ?? p?.contact?.phone;
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

export function ProfileWizard({ initialProfile, onSaved }: ProfileWizardProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<Profile>(normalizeProfile(initialProfile) ?? emptyProfile());
  const [extractedProfile, setExtractedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeProgress, setResumeProgress] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [dailyXp, setDailyXp] = useState(0);
  const [lifetimeXp, setLifetimeXp] = useState(0);
  const [streak, setStreak] = useState(0);

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
    const loadGamification = async () => {
      const state = await fetchGamificationDaily();
      if (!state) return;
      setDailyXp(state.daily.xp ?? 0);
      setLifetimeXp(state.meta.lifetimeXp ?? 0);
      setStreak(state.meta.streak ?? 0);
    };
    void loadAiStatus();
    void loadGamification();
  }, []);

  useEffect(() => {
    if (initialProfile) {
      setProfile(normalizeProfile(initialProfile));
    }
  }, [initialProfile]);

  const readiness = useMemo(() => evaluateReadiness(profile as unknown as Record<string, unknown>), [profile]);

  const level = Math.max(1, Math.floor(lifetimeXp / 200) + 1);
  const nextLevelAt = level * 200;
  const xpToNext = Math.max(0, nextLevelAt - lifetimeXp);
  const missionItems =
    readiness.missing.length > 0
      ? readiness.missing.slice(0, 3)
      : ["Add a fresh accomplishment", "Review target roles", "Save latest profile"];

  const fillFromExtract = () => {
    if (!extractedProfile) {
      toast({
        title: "Extract a resume first",
        description: "Upload and extract a resume to auto-fill missing fields.",
        variant: "destructive",
      });
      return;
    }

    const merged: Profile = {
      ...profile,
      fullName: profile.fullName || extractedProfile.fullName,
      email: profile.email || extractedProfile.email,
      phone: profile.phone || extractedProfile.phone,
      location: profile.location || extractedProfile.location,
      linkedin: profile.linkedin || extractedProfile.linkedin,
      github: profile.github || extractedProfile.github,
      portfolio: profile.portfolio || extractedProfile.portfolio,
      visaStatus: profile.visaStatus || extractedProfile.visaStatus,
      targetRoles: profile.targetRoles.length ? profile.targetRoles : extractedProfile.targetRoles,
      preferredLocations: profile.preferredLocations.length
        ? profile.preferredLocations
        : extractedProfile.preferredLocations,
      preferredWorkModes: profile.preferredWorkModes?.length
        ? profile.preferredWorkModes
        : extractedProfile.preferredWorkModes,
      preferredSeniority: profile.preferredSeniority?.length
        ? profile.preferredSeniority
        : extractedProfile.preferredSeniority,
      yearsExperienceApprox:
        profile.yearsExperienceApprox ?? extractedProfile.yearsExperienceApprox,
      skills: {
        languages: profile.skills.languages.length
          ? profile.skills.languages
          : extractedProfile.skills.languages,
        tools: profile.skills.tools.length
          ? profile.skills.tools
          : extractedProfile.skills.tools,
        cloud: profile.skills.cloud.length
          ? profile.skills.cloud
          : extractedProfile.skills.cloud,
        databases: profile.skills.databases.length
          ? profile.skills.databases
          : extractedProfile.skills.databases,
      },
      workExperience: profile.workExperience.length
        ? profile.workExperience
        : extractedProfile.workExperience,
      projects: profile.projects.length ? profile.projects : extractedProfile.projects,
      education: profile.education.length ? profile.education : extractedProfile.education,
      certifications: profile.certifications.length
        ? profile.certifications
        : extractedProfile.certifications,
      hobbies: profile.hobbies?.length ? profile.hobbies : extractedProfile.hobbies,
      preferredTitles: profile.preferredTitles?.length
        ? profile.preferredTitles
        : extractedProfile.preferredTitles,
    };

    setProfile(merged);
    toast({ title: "Filled missing fields", description: "Seeded from resume extract." });
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
      const normalized = normalizeProfile(data.profileJson ?? {});
      setProfile(normalized);
      setExtractedProfile(normalized);
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

    setSaving(true);
    try {
      const res = await fetch("/api/profile/save", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ profileJson: profile }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save profile");
      }
      const state = await trackGamificationEvent("profile_saved");
      if (state) {
        setDailyXp(state.daily.xp ?? 0);
        setLifetimeXp(state.meta.lifetimeXp ?? 0);
        setStreak(state.meta.streak ?? 0);
      }
      toast({ title: "Profile saved" });
      onSaved?.(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Profile Power
              </p>
              <h3 className="text-2xl font-semibold text-foreground">
                Level {level} • {dailyXp} XP today
              </h3>
              <p className="text-sm text-muted-foreground">
                {streak > 0
                  ? `${streak} day streak active.`
                  : "Start a streak by completing today’s missions."}{" "}
                Earn {xpToNext} XP to reach Level {level + 1}.
              </p>
            </div>
            <div className="min-w-[220px] space-y-2">
              <Progress value={Math.min(100, (lifetimeXp / nextLevelAt) * 100)} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Level progress</span>
                <span>
                  {lifetimeXp}/{nextLevelAt} XP
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-primary" />
            Daily missions
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete missions to unlock stronger recommendations.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {missionItems.map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-lg border border-white/50 bg-white/70 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!aiEnabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          AI extraction is disabled until an OpenAI key is configured. You can still build your profile manually.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Step 1 — Upload & extract</CardTitle>
            <CardDescription>Resume text becomes structured profile data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
            <div className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              We only extract facts that appear in your resume. No fabrication.
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Step 2 — Validate readiness</CardTitle>
            <CardDescription>Fix missing fields and unlock tailoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </div>
            <ul className="space-y-2 text-sm">
              {["name", "email or phone", "target roles", "at least 2 projects", "work experience", "skills (grouped)"].map((item) => {
                const missing = readiness.missing.includes(item);
                return (
                  <li
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-sm"
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
            <Button size="sm" variant="outline" onClick={fillFromExtract}>
              Fill from resume extract
            </Button>
          </CardContent>
        </Card>
      </div>

      <ProfileBuilder profile={profile} onChange={setProfile} />
      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save profile
        </Button>
      </div>
    </div>
  );
}
