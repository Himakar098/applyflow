import Link from "next/link";
import { BookOpen, HelpCircle, Puzzle, Scale, ShieldCheck } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const resources = [
  {
    title: "Browser extension guide",
    description: "How the Apply Assistant extension works, where it helps, and what still requires manual review.",
    icon: Puzzle,
    href: "/browser-extension",
  },
  {
    title: "Privacy policy",
    description: "What data ApplyFlow handles, how it is used, and how to contact Omnari Group about data requests.",
    icon: ShieldCheck,
    href: "/privacy",
  },
  {
    title: "Terms of service",
    description: "Account use, AI-content responsibilities, platform limits, and legal terms for the service.",
    icon: Scale,
    href: "/terms",
  },
  {
    title: "Cookie policy",
    description: "The minimal cookies used for secure sessions and product analytics.",
    icon: BookOpen,
    href: "/cookies",
  },
  {
    title: "Support",
    description: "For rollout, legal, privacy, or product questions, contact Omnari directly.",
    icon: HelpCircle,
    href: `mailto:${siteConfig.supportEmail}`,
  },
];

export default function ResourcesPage() {
  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <Badge className="rounded-full" variant="secondary">
          Resources
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Public reference pages for ApplyFlow.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          These pages cover the core public information: setup guidance, legal terms, privacy handling,
          and direct support access through {siteConfig.companyName}.
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
          <h3 className="text-2xl font-semibold text-foreground">Need a direct answer?</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Contact {siteConfig.companyName} for support, legal, privacy, or rollout questions.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={siteConfig.productOverviewUrl}>View Omnari product page</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
