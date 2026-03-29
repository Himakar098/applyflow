"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { betaConfig, getBetaPrimaryCta, getBetaSecondaryCta } from "@/lib/beta/config";

export function PublicBetaBanner() {
  if (!betaConfig.enabled) return null;

  const primary = getBetaPrimaryCta();
  const secondary = getBetaSecondaryCta();

  return (
    <div className="border-b border-primary/15 bg-primary/8">
      <div className="container flex flex-col gap-3 py-3 text-sm text-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
            {betaConfig.label}
          </span>
          <p className="text-sm text-muted-foreground">{betaConfig.bannerText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
