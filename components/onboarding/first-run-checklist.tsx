"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CircleDashed,
  Puzzle,
  Target,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { pingApplyFlowExtension } from "@/lib/extension-bridge/client";

type FirstRunChecklistProps = {
  userId: string;
  readinessScore: number;
  hasResume: boolean;
  hasSavedJob: boolean;
  hasAppliedJob: boolean;
};

const LOCAL_STORAGE_PREFIX = "applyflow:first-run-hidden:";

export function FirstRunChecklist({
  userId,
  readinessScore,
  hasResume,
  hasSavedJob,
  hasAppliedJob,
}: FirstRunChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<"checking" | "connected" | "not_detected">("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`) === "1");
  }, [userId]);

  useEffect(() => {
    const check = async () => {
      setExtensionStatus("checking");
      try {
        const result = await pingApplyFlowExtension();
        if (!result.ok || !result.installed) {
          throw new Error(result.error || "extension_not_detected");
        }
        setExtensionStatus("connected");
      } catch {
        setExtensionStatus("not_detected");
      }
    };

    void check();
  }, []);

  const steps = useMemo(
    () => [
      {
        key: "profile",
        title: "Build your profile",
        description: `Target 70%+ readiness. Current score: ${readinessScore}/100.`,
        href: "/profile",
        cta: "Open profile",
        done: readinessScore >= 70,
        icon: UserRound,
      },
      {
        key: "resume",
        title: "Upload a resume",
        description: "Use a resume to speed up profile extraction and tailored packs.",
        href: "/resume",
        cta: "Open resumes",
        done: hasResume,
        icon: CircleDashed,
      },
      {
        key: "jobs",
        title: "Save your first role",
        description: "Use Search or Recommendations and push one role into the tracker.",
        href: "/recommendations",
        cta: "Open recommendations",
        done: hasSavedJob,
        icon: Target,
      },
      {
        key: "extension",
        title: "Install the extension",
        description: "This unlocks faster apply flows on company career pages.",
        href: "/extensions",
        cta: "Open extensions",
        done: extensionStatus === "connected",
        icon: Puzzle,
      },
      {
        key: "apply",
        title: "Mark your first application",
        description: "Complete one real application and move it to Applied in the tracker.",
        href: "/jobs",
        cta: "Open tracker",
        done: hasAppliedJob,
        icon: Briefcase,
      },
    ],
    [extensionStatus, hasAppliedJob, hasResume, hasSavedJob, readinessScore],
  );

  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  const hideChecklist = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, "1");
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className="surface-card border-primary/20">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            Follow this setup path once. After that, ApplyFlow becomes much faster to use.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            {completed}/{steps.length} complete
          </Badge>
          <Button variant="ghost" size="sm" onClick={hideChecklist}>
            Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">
            Progress: <span className="font-semibold text-foreground">{progress}%</span>
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.done ? CheckCircle2 : step.icon;
            return (
              <div
                key={step.key}
                className="rounded-xl border border-white/60 bg-white/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${step.done ? "text-emerald-600" : "text-primary"}`} />
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  </div>
                  <Badge variant={step.done ? "default" : "secondary"}>
                    {step.done ? "Done" : "Next"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                {!step.done ? (
                  <Button asChild size="sm" variant="outline" className="mt-4">
                    <Link href={step.href}>
                      {step.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
