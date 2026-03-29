"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Sparkles, Target, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type WelcomeModalProps = {
  userId: string;
  readinessScore: number;
  hasResume: boolean;
  hasSavedJob: boolean;
  hasAppliedJob: boolean;
};

const STORAGE_PREFIX = "applyflow:onboarding-welcome-seen:";

export function WelcomeModal({
  userId,
  readinessScore,
  hasResume,
  hasSavedJob,
  hasAppliedJob,
}: WelcomeModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const nextStep = useMemo(() => {
    if (readinessScore < 70) {
      return {
        label: "Build your profile",
        description: "Start by filling your profile so recommendations and tailored content have enough signal.",
        href: "/profile",
      };
    }

    if (!hasResume) {
      return {
        label: "Upload a resume",
        description: "A stored resume speeds up profile extraction and future application work.",
        href: "/resume",
      };
    }

    if (!hasSavedJob) {
      return {
        label: "Save your first role",
        description: "Use recommendations or search to push your first role into the tracker.",
        href: "/recommendations",
      };
    }

    if (!hasAppliedJob) {
      return {
        label: "Complete your first application",
        description: "Use Apply Assistant and move one real role to Applied.",
        href: "/jobs",
      };
    }

    return {
      label: "Open dashboard",
      description: "You already have the core setup in place.",
      href: "/dashboard",
    };
  }, [hasAppliedJob, hasResume, hasSavedJob, readinessScore]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seen = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`) === "1";
    const needsOnboarding =
      readinessScore < 70 || !hasResume || !hasSavedJob || !hasAppliedJob;
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
      setOpen(!seen && needsOnboarding);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [userId, readinessScore, hasResume, hasSavedJob, hasAppliedJob]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, "1");
    }
    setOpen(false);
  };

  const startSetup = () => {
    close();
    router.push(nextStep.href);
  };

  if (!hydrated || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-900/15">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
          aria-label="Close welcome modal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-r from-primary/10 via-emerald-100/60 to-sky-100/60 px-6 py-6 md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            <Sparkles className="h-4 w-4" />
            Welcome to ApplyFlow
          </div>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">
            Set up once, then use ApplyFlow as your job search workspace.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            ApplyFlow builds a reusable profile, recommends roles that fit, keeps your tracker organized,
            and helps you move through employer application pages faster with the Apply Assistant.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.25fr,0.95fr] md:px-8">
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Build your profile once</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Resume extraction and manual editing feed your recommendations and tailored content.
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Work from recommendations</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Save good-fit jobs into the tracker and focus on the strongest next opportunities.
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Apply with control</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use Apply Assistant and the browser extension to fill forms faster, then review before submission.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/15 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Recommended next step
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">{nextStep.label}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{nextStep.description}</p>

            <div className="mt-5 space-y-3 rounded-2xl border border-white/70 bg-white/80 p-4">
              <p className="text-sm font-semibold text-foreground">Why this matters</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Recommendations improve when the profile has enough detail.</li>
                <li>The tracker becomes useful once at least one real role is saved.</li>
                <li>The extension matters most when the application lives on a company careers page.</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button onClick={startSetup} className="flex-1">
                Start setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={close} variant="outline" className="flex-1">
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
