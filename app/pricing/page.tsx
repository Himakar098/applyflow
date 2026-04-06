import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const accessCards = [
  {
    name: "Individual workspace",
    description:
      "Create an account and use the current ApplyFlow workspace for profile setup, role review, tailored materials, and application tracking.",
    points: [
      "Dashboard access",
      "Resume import and profile setup",
      "Recommendations, search, and tracker",
      "Tailored resume and cover-letter workflows",
    ],
    ctaLabel: "Create account",
    ctaHref: "/register",
  },
  {
    name: "Team or partner access",
    description:
      "If you need coaching, cohort, or partner rollout support, contact Omnari Group directly.",
    points: [
      "Advisor and coach workflows",
      "Education or bootcamp discussions",
      "Partner rollout planning",
      "Commercial and legal queries",
    ],
    ctaLabel: "Contact Omnari",
    ctaHref: `mailto:${siteConfig.supportEmail}`,
  },
];

export default function PricingPage() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Current access.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          ApplyFlow is available as a live product. Individual access is self-serve.
          Team, partner, and commercial discussions are handled directly by {siteConfig.companyName}.
        </p>
      </section>

      <section className="container grid gap-6 md:grid-cols-2">
        {accessCards.map((card) => (
          <div key={card.name} className="surface-panel flex h-full flex-col gap-6 p-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-foreground">{card.name}</h2>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
            <div className="space-y-2">
              {card.points.map((point) => (
                <div key={point} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {point}
                </div>
              ))}
            </div>
            <Button asChild className="mt-auto">
              <Link href={card.ctaHref}>{card.ctaLabel}</Link>
            </Button>
          </div>
        ))}
      </section>

      <section className="container">
        <div className="surface-card flex flex-col items-center gap-4 p-6 text-center md:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Need a formal access conversation?</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Use the current workspace today, or contact {siteConfig.companyName} if you need
            rollout support, legal review, or commercial terms.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
