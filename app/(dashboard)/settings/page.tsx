"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { DocumentVault } from "@/components/settings/document-vault";
import { ProfileBuilder } from "@/components/settings/profile-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import { trackGamificationEvent } from "@/lib/gamification/client";
import { computeReadiness } from "@/lib/profile/readiness";
import type { Profile } from "@/lib/types";
import { emptyProfile, normalizeProfile } from "@/lib/profile/normalize";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  const readiness = useMemo(() => computeReadiness(profile), [profile]);

  const loadProfile = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      if (!headers) return;
      const res = await fetch("/api/profile/current", { headers });
      if (res.status === 404) {
        setProfile(emptyProfile());
        return;
      }
      if (!res.ok) {
        throw new Error("Unable to load profile");
      }
      const data = (await res.json()) as { profileJson?: Profile };
      setProfile(normalizeProfile(data.profileJson));
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load profile",
        description: "Check your Firebase configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProfile();
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
  }, [loadProfile]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      const headers = await getAuthHeader();
      if (!headers) {
        toast({
          title: "Session required",
          description: "Sign in to save your profile.",
          variant: "destructive",
        });
        return;
      }
      const res = await fetch("/api/profile/save", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ profileJson: { ...profile, email: user?.email ?? profile.email } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save profile");
      }
      await trackGamificationEvent("profile_saved");
      await trackAnalyticsEvent("profile_saved", { readinessScore: readiness.score });
      toast({ title: "Profile saved", description: "Your profile builder details are up to date." });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save profile",
        description: "Try again later.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h2 className="text-2xl font-semibold text-foreground">Profile builder</h2>
        <p className="text-sm text-muted-foreground">
          Build your profile manually or alongside resume extraction. No fake defaults—only what you enter.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        {loading ? (
          <Skeleton className="h-[600px] w-full rounded-xl" />
        ) : (
          <ProfileBuilder profile={profile} onChange={setProfile} />
        )}

        <Card className="surface-card h-fit">
          <CardHeader>
            <CardTitle>Profile readiness</CardTitle>
            <CardDescription>Checklist used to boost generation quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Progress value={readiness.score} />
              <p className="text-sm text-muted-foreground">
                Score: <span className="font-semibold text-foreground">{readiness.score}</span>/100
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Missing items</p>
              {readiness.missing.length === 0 ? (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Ready to tailor
                </Badge>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {readiness.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button className="w-full" onClick={saveProfile} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save profile"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Saved under <code>users/&lt;uid&gt;/profile/current</code>. This powers tailoring even without a resume.
            </p>
          </CardContent>
        </Card>
      </div>

      {!aiEnabled ? (
        <Card className="border-0 bg-amber-50 shadow-sm shadow-amber-900/5">
          <CardHeader>
            <CardTitle>AI features disabled</CardTitle>
            <CardDescription>
              AI features are disabled until an OpenAI key is set by the admin.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <DocumentVault className="surface-card" />
    </div>
  );
}
