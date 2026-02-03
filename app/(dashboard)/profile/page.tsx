"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { ProfileWizard } from "@/components/profile/profile-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import type { Profile } from "@/lib/types";

type ProfileResponse = {
  ok: boolean;
  profileJson?: Profile;
  resumeText?: string;
  updatedAt?: string | null;
  error?: string;
};

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [initialProfile, setInitialProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingProfile, setMissingProfile] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setMissingProfile(false);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/profile/current", { headers });
      const data = (await res.json()) as ProfileResponse;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 404 || data.error === "PROFILE_NOT_FOUND") {
        setMissingProfile(true);
        setInitialProfile(null);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Unable to load profile");
      }
      setInitialProfile(data.profileJson ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile";
      toast({ title: "Profile load failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="surface-panel hero-panel p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Profile HQ
            </p>
            <h2 className="text-3xl font-semibold text-foreground">
              Build your strongest profile once, then reuse everywhere.
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Upload a resume or fill manually. We translate it into structured data, score your
              readiness, and unlock smarter recommendations and faster applications.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="chip">Step 1: Upload</span>
              <span className="chip">Step 2: Extract</span>
              <span className="chip">Step 3: Polish</span>
              <span className="chip">Step 4: Save</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-primary" />
            <span>Aim for 80%+ readiness to unlock stronger matches.</span>
          </div>
        </div>
      </div>

      <Card className="surface-card">
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle>Profile console</CardTitle>
            <CardDescription>
              Upload, extract, validate readiness, and save for tailoring.
            </CardDescription>
          </div>
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : missingProfile ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              No profile yet. Upload a resume or build one manually below.
            </div>
          ) : null}
          {!loading ? (
            <ProfileWizard
              initialProfile={initialProfile ?? undefined}
              onSaved={() => {
                toast({ title: "Profile saved" });
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
