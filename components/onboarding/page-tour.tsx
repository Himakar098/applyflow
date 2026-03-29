"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TourStep = {
  title: string;
  description: string;
  href?: string;
  ctaLabel?: string;
};

type PageTourProps = {
  storageKey: string;
  userId?: string | null;
  eyebrow: string;
  title: string;
  description: string;
  steps: TourStep[];
  badgeLabel?: string;
};

const STORAGE_PREFIX = "applyflow:page-tour:";

export function PageTour({
  storageKey,
  userId,
  eyebrow,
  title,
  description,
  steps,
  badgeLabel,
}: PageTourProps) {
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = `${STORAGE_PREFIX}${storageKey}:${userId ?? "anon"}`;
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
      setVisible(window.localStorage.getItem(key) !== "1");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [storageKey, userId]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}:${userId ?? "anon"}`, "1");
    }
    setVisible(false);
  };

  if (!hydrated || !visible) return null;

  return (
    <Card className="surface-card border-primary/20">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              {eyebrow}
            </div>
            {badgeLabel ? (
              <Badge variant="secondary">{badgeLabel}</Badge>
            ) : null}
          </div>
          <CardTitle className="mt-3">{title}</CardTitle>
          <CardDescription className="mt-1 max-w-3xl">{description}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss}>
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss tour</span>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div key={`${step.title}-${index}`} className="rounded-xl border border-white/60 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {index + 1}. {step.title}
              </p>
              <CheckCircle2 className="h-4 w-4 text-primary/60" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            {step.href && step.ctaLabel ? (
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link href={step.href}>
                  {step.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
