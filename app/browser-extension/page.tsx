import Link from "next/link";
import { Download, ExternalLink, Puzzle, ShieldCheck } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { browserCards, supportedExtensionSites } from "@/lib/extension/catalog";

export default function BrowserExtensionPage() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <Badge className="rounded-full" variant="secondary">
          Browser extension
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Install the ApplyFlow extension for supported employer sites.
        </h1>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground">
          The extension is used when a job application lives on an employer careers page rather than inside Seek,
          LinkedIn, or another aggregator. ApplyFlow prepares the job context, then the extension helps fill the form
          faster. You still review before submission.
        </p>
      </section>

      <section className="container grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>What it does</CardTitle>
            <CardDescription>Current public-beta behavior.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Syncs job context from ApplyFlow</p>
              <p className="mt-2 text-sm text-muted-foreground">
                The app sends your job, profile fields, and reusable answers into the extension.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Autofills supported ATS pages</p>
              <p className="mt-2 text-sm text-muted-foreground">
                The extension uses site-specific selectors first, then a generic field-matching fallback.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Keeps review in the loop</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You still confirm the application on the employer page before it is counted as submitted.
              </p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 p-4">
              <p className="text-sm font-semibold text-foreground">Pauses and resumes around blockers</p>
              <p className="mt-2 text-sm text-muted-foreground">
                CAPTCHAs, MFA, file-attachment restrictions, and login walls still require manual user action, but the extension can hold the session and resume autofill after you clear them.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Best use cases
            </CardTitle>
            <CardDescription>Where it helps most in beta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Company career pages using supported ATS families.</p>
            <p>Jobs where you already know the role is a strong fit and want to reduce repetitive typing.</p>
            <p>Applications that ask common contact, location, work-rights, and written-answer questions.</p>
            <div className="pt-2">
              <Button asChild>
                <Link href={primaryCta.href}>{primaryCta.label}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container space-y-4">
        <div className="flex flex-col gap-2 text-center">
          <Badge className="mx-auto rounded-full" variant="secondary">
            Supported coverage
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground">Current supported ATS and company families</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {supportedExtensionSites.map((site) => (
            <Badge key={site} variant="secondary">
              {site}
            </Badge>
          ))}
        </div>
      </section>

      <section className="container grid gap-4 lg:grid-cols-3">
        {browserCards.map((browser) => {
          const Icon = browser.icon;
          return (
            <Card key={browser.id} className="surface-card">
              <CardHeader>
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
                {browser.installHref ? (
                  <div className="space-y-2">
                    <Button asChild className="w-full">
                      <a href={browser.installHref} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {browser.installLabel}
                      </a>
                    </Button>
                    {browser.downloadHref ? (
                      <Button asChild variant="outline" className="w-full">
                        <a href={browser.downloadHref} download>
                          <Download className="mr-2 h-4 w-4" />
                          {browser.downloadLabel ?? "Manual package"}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : browser.downloadHref ? (
                  <Button asChild className="w-full">
                    <a href={browser.downloadHref} download>
                      <Download className="mr-2 h-4 w-4" />
                      {browser.installLabel}
                    </a>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    {browser.installLabel}
                  </Button>
                )}
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
      </section>

      <section className="container">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Quick use flow</CardTitle>
            <CardDescription>The intended beta workflow once the extension is installed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              "Open Apply Assistant for the job and sync the extension context.",
              "Open the employer careers page in the same browser.",
              "Click Start assisted autofill in the extension popup.",
              "If login, CAPTCHA, or MFA appears, clear it on that tab. Autofill resumes automatically.",
            ].map((step, index) => (
              <div key={step} className="rounded-xl border border-white/60 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {index + 1}</p>
                <p className="mt-2 text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-4 px-6 py-10 text-center md:px-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Puzzle className="h-4 w-4" />
            Public beta note
          </div>
          <h3 className="text-2xl font-semibold text-foreground">The extension is part of the beta workflow, not a universal autopilot.</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The best current ApplyFlow experience is: build profile, review recommendations, open Apply Assistant,
            sync the extension, finish the employer form, then confirm the submission back in ApplyFlow.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/resources">Read resources</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
