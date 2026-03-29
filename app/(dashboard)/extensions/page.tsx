"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  Puzzle,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { browserCards, supportedExtensionSites } from "@/lib/extension/catalog";
import { pingApplyFlowExtension } from "@/lib/extension-bridge/client";
import { siteConfig } from "@/lib/site-config";

export default function ExtensionsPage() {
  const { toast } = useToast();
  const [extensionStatus, setExtensionStatus] = useState<"checking" | "connected" | "not_detected">("checking");
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);

  const copySteps = async (steps: readonly string[]) => {
    try {
      await navigator.clipboard.writeText(steps.map((step, index) => `${index + 1}. ${step}`).join("\n"));
      toast({ title: "Steps copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  useEffect(() => {
    const check = async () => {
      setExtensionStatus("checking");
      try {
        const result = await pingApplyFlowExtension();
        if (!result.ok || !result.installed) {
          throw new Error(result.error || "extension_not_detected");
        }
        setExtensionStatus("connected");
        setExtensionVersion(result.version ?? null);
      } catch {
        setExtensionStatus("not_detected");
        setExtensionVersion(null);
      }
    };

    void check();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="surface-panel hero-panel">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <Puzzle className="h-4 w-4" />
              Browser setup
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-foreground">Install the Apply Assistant extension</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Use the extension when a company application page needs form filling on its own careers site.
                ApplyFlow prepares the job context, your profile data, and reusable answers. The extension fills what
                it can, and you still review before submission.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                Review-before-submit
              </Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                Chrome + Edge install
              </Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                Supports major ATS families
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="#chrome">Chrome setup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="#edge">Edge setup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="#safari">Safari setup</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Extension status in this browser</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {extensionStatus === "connected"
                ? "The ApplyFlow extension is installed in this browser. You can open Apply Assistant and sync context directly."
                : extensionStatus === "checking"
                  ? "Checking whether the ApplyFlow extension is available in this browser."
                  : "The ApplyFlow extension was not detected in this browser yet. Use the download steps below."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={extensionStatus === "connected" ? "default" : "secondary"}>
              {extensionStatus === "connected" ? "Connected" : extensionStatus === "checking" ? "Checking..." : "Not detected"}
            </Badge>
            {extensionVersion ? <Badge variant="secondary">v{extensionVersion}</Badge> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr,1fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>What the extension does</CardTitle>
            <CardDescription>Current beta behavior inside the supported apply flow.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Reads ApplyFlow context</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The Apply Assistant syncs a structured payload with the selected job, profile fields, and common answers.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Autofills supported sites</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The extension uses ATS-specific selectors first, then falls back to generic field matching.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Keeps you in control</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ApplyFlow does not auto-submit silently. You review the form, upload files manually if needed, then confirm.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Pauses and resumes around blockers</p>
              <p className="mt-1 text-sm text-muted-foreground">
                If the employer page shows login, CAPTCHA, MFA, or another security step, the extension holds the session and resumes autofill after you clear it on the same tab.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Works with your tracker</p>
              <p className="mt-1 text-sm text-muted-foreground">
                After you finish on the employer site, confirm inside ApplyFlow and the job moves to Applied.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Current limits
            </CardTitle>
            <CardDescription>Important boundaries in the current beta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>File upload fields still need manual selection because browsers block silent file attachment.</p>
            <p>CAPTCHAs, MFA, anti-bot checks, and employer login walls are not bypassed.</p>
            <p>Some career pages block iframe embedding, so the mini browser falls back to a normal browser tab.</p>
            <p>
              Safari public one-click install is still in progress. Use Chrome or Edge for the easiest setup.
            </p>
            <p>
              Need help installing? Contact{" "}
              <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${siteConfig.supportEmail}`}>
                {siteConfig.supportEmail}
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Supported ATS and company portals</CardTitle>
          <CardDescription>Current adapters in the autofill engine.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {supportedExtensionSites.map((site) => (
            <Badge key={site} variant="secondary">
              {site}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Quick use flow</CardTitle>
          <CardDescription>The shortest path once the extension is installed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {[
            "Open Apply Assistant for the job and click Sync to extension.",
            "Open the employer application page in the same browser.",
            "Click Start assisted autofill in the extension popup.",
            "If login, CAPTCHA, or MFA appears, complete it on that tab. The extension resumes automatically.",
          ].map((step, index) => (
            <div key={step} className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {index + 1}</p>
              <p className="mt-2 text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {browserCards.map((browser) => {
          const Icon = browser.icon;
          return (
            <Card key={browser.id} id={browser.id} className="surface-card scroll-mt-24">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      {browser.title}
                    </CardTitle>
                    <CardDescription>{browser.subtitle}</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                    {browser.badge}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{browser.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {browser.installHref ? (
                    <Button asChild className="flex-1">
                      <a href={browser.installHref} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {browser.installLabel}
                      </a>
                    </Button>
                  ) : browser.downloadHref ? (
                    <Button asChild className="flex-1">
                      <a href={browser.downloadHref} download>
                        <Download className="mr-2 h-4 w-4" />
                        {browser.installLabel}
                      </a>
                    </Button>
                  ) : (
                    <Button className="flex-1" disabled>
                      {browser.installLabel}
                    </Button>
                  )}
                  {browser.installHref && browser.downloadHref ? (
                    <Button asChild variant="outline">
                      <a href={browser.downloadHref} download>
                        <Download className="mr-2 h-4 w-4" />
                        {browser.downloadLabel ?? "Manual package"}
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => void copySteps(browser.steps)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy steps
                  </Button>
                </div>
                <Separator />
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {browser.steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Use it in ApplyFlow</CardTitle>
          <CardDescription>The intended flow once the extension is installed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">1. Open a recommendation</p>
            <p className="mt-1">From Recommendations, click Apply to create or reuse the job workspace.</p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">2. Copy context</p>
            <p className="mt-1">Inside Apply Assistant, copy the extension context for that specific job.</p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">3. Run autofill</p>
            <p className="mt-1">Open the employer application page, paste or use saved context, then run autofill.</p>
          </div>
          <div className="rounded-xl border border-white/60 bg-white/70 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">4. Confirm submit</p>
            <p className="mt-1">After review and submission, mark the job as Applied and remove it from recommendations.</p>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/recommendations">
                Open recommendations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/jobs">Open job tracker</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
