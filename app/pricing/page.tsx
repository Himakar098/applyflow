import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const accessCards = [
  {
    name: "Current workspace access",
    description:
      "Create an account and use the core ApplyFlow workspace for profile setup, recommendations, application materials, and tracking.",
    points: [
      "Account creation and dashboard access",
      "Profile building and resume import",
      "Recommendations, search, and job tracker",
      "Tailored application material workflows",
    ],
    ctaLabel: "Create account",
    ctaHref: "/register",
  },
  {
    name: "Team and partnership planning",
    description:
      "If you need cohort access, advisor workflows, or a branded rollout path, contact Omnari Group directly.",
    points: [
      "Career-coach and advisor discussions",
      "Training provider and bootcamp planning",
      "Partner rollout and legal review",
      "Commercial access questions",
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
        <Badge className="rounded-full" variant="secondary">
          Access
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Clear access now. Commercial details later.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          ApplyFlow is publicly accessible as a working product. Formal commercial packaging and
          partner arrangements are handled directly by {siteConfig.companyName}.
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
        <div className="surface-card space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Questions about access, legal terms, or rollout?</h3>
          <p className="text-sm text-muted-foreground">
            Use the current workspace, or contact {siteConfig.companyName} directly if you need a formal commercial path.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`mailto:${siteConfig.supportEmail}`}>Email {siteConfig.supportEmail}</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
