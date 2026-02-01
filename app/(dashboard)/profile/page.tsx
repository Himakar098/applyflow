"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { ProfileWizard } from "@/components/profile/profile-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";

type ProfileResponse = {
  ok: boolean;
  profileJson?: unknown;
  resumeText?: string;
  updatedAt?: string | null;
  error?: string;
};

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [initialProfileText, setInitialProfileText] = useState<string>("");
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
        setInitialProfileText("");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Unable to load profile");
      }
      setInitialProfileText(JSON.stringify(data.profileJson ?? {}, null, 2));
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
      <Card className="border-0 bg-white shadow-sm shadow-slate-900/5">
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Upload a resume, extract structured data, validate readiness, and save for tailoring.
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
              No profile yet. Upload your resume to create a profile.
            </div>
          ) : null}
          {!loading ? (
            <ProfileWizard
              initialProfileText={initialProfileText}
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
