import Link from "next/link";
import { BookOpen, HelpCircle, Puzzle, Scale, ShieldCheck } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const resources = [
  {
    title: "Browser extension guide",
    description: "How the Apply Assistant extension works and where manual review is still required.",
    icon: Puzzle,
    href: "/browser-extension",
  },
  {
    title: "Privacy policy",
    description: "What data ApplyFlow handles and how to contact Omnari Group about privacy requests.",
    icon: ShieldCheck,
    href: "/privacy",
  },
  {
    title: "Terms of service",
    description: "Account use, product limits, and responsibilities around generated application content.",
    icon: Scale,
    href: "/terms",
  },
  {
    title: "Cookie policy",
    description: "The cookies used for sessions, product behavior, and operational analytics.",
    icon: BookOpen,
    href: "/cookies",
  },
];

export default function ResourcesPage() {
  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Public reference pages.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          Setup notes, product boundaries, and legal documents for ApplyFlow.
        </p>
      </section>

      <section className="container grid gap-6 md:grid-cols-2">
        {resources.map((resource) => {
          const Icon = resource.icon;

          return (
            <Link
              key={resource.title}
              href={resource.href}
              className="surface-card block space-y-4 p-6 transition hover:-translate-y-0.5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{resource.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-4 px-6 py-10 text-center md:px-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Need a direct answer?</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            For support, legal, privacy, or rollout questions, contact {siteConfig.companyName} directly.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={siteConfig.productOverviewUrl}>Omnari product page</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
