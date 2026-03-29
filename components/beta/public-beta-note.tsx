"use client";

import Link from "next/link";
import { FlaskConical, Wrench } from "lucide-react";

import { betaConfig } from "@/lib/beta/config";

export function PublicBetaNote() {
  if (!betaConfig.enabled) return null;

  return (
    <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">{betaConfig.label}</p>
          <p>
            ApplyFlow is live in beta. Supported-site coverage varies across employer career pages,
            and the browser extension works best on the listed ATS families.
          </p>
          <p className="inline-flex items-center gap-1 text-xs">
            <Wrench className="h-3.5 w-3.5" />
            <Link href="/browser-extension" className="font-medium text-primary underline-offset-4 hover:underline">
              View browser extension setup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
