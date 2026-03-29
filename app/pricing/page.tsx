import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

export default function PricingPage() {
  const primaryCta = getBetaPrimaryCta();
  const tiers = [
    {
      name: "Free",
      description: "Get started with profile building and core tracking.",
      badge: "Available now",
      features: [
        "Resume upload + profile extraction",
        "Job recommendations and saved searches",
        "Application tracker + reminders",
        "Basic tailored packs",
      ],
      ctaLabel: primaryCta.label,
      ctaHref: primaryCta.href,
    },
    {
      name: "Pro",
      description: "Advanced AI assistance and deeper insights.",
      badge: "Coming soon",
      features: [
        "Unlimited tailored packs",
        "Advanced job matching filters",
        "Priority AI generation",
        "Weekly performance insights",
      ],
      ctaLabel: "Contact support",
      ctaHref: `mailto:${siteConfig.supportEmail}`,
    },
  ];

  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <Badge className="rounded-full" variant="secondary">
          Pricing
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Simple pricing that scales with your job search.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Start free and upgrade when you want deeper AI support. Pricing details will be
          announced soon.
        </p>
      </section>

      <section className="container grid gap-6 md:grid-cols-2">
        {tiers.map((tier) => (
          <div key={tier.name} className="surface-panel flex h-full flex-col gap-6 p-8">
            <div className="space-y-3">
              <Badge className="rounded-full" variant="secondary">
                {tier.badge}
              </Badge>
              <h2 className="text-2xl font-semibold text-foreground">{tier.name}</h2>
              <p className="text-sm text-muted-foreground">{tier.description}</p>
            </div>
            <div className="space-y-2">
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {feature}
                </div>
              ))}
            </div>
            <Button asChild className="mt-auto">
              <Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
            </Button>
          </div>
        ))}
      </section>

      <section className="container">
        <div className="surface-card space-y-4 p-6 text-center">
          <h3 className="text-xl font-semibold text-foreground">Need a custom plan?</h3>
          <p className="text-sm text-muted-foreground">
            We can support teams, bootcamps, and career coaches with tailored solutions.
          </p>
          <Button asChild variant="outline">
            <Link href={`mailto:${siteConfig.supportEmail}`}>Contact support</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
