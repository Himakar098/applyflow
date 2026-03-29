import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { LandingHero } from "@/components/marketing/landing-hero";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";

const benefits = [
  {
    title: "Higher-fit roles",
    description:
      "Prioritize jobs that match your profile, goals, and location.",
    points: ["Profile match", "Relevant roles", "Clear fit signal"],
    icon: Target,
  },
  {
    title: "Fresh opportunities",
    description:
      "Review newly posted roles quickly while applications are still open.",
    points: ["Recent postings", "Open applications", "Faster response"],
    icon: Sparkles,
  },
  {
    title: "Faster applications",
    description:
      "Reuse profile data and tailored content instead of rewriting from scratch.",
    points: ["Less repetition", "Reusable content", "Shorter cycle time"],
    icon: LineChart,
  },
  {
    title: "Pipeline control",
    description:
      "Track status, notes, and next steps from one dashboard.",
    points: ["Single tracker", "Status visibility", "Action queue"],
    icon: ClipboardCheck,
  },
];

const features = [
  {
    title: "Profile intelligence",
    description: "Convert resume data into a structured profile.",
    icon: Sparkles,
  },
  {
    title: "Job recommendations",
    description: "Match roles to your profile and preferences.",
    icon: Target,
  },
  {
    title: "Search workspace",
    description: "Search with filters and keep saved queries.",
    icon: Filter,
  },
  {
    title: "Tailored apply packs",
    description: "Generate role-specific resume and cover-letter content.",
    icon: FileText,
  },
  {
    title: "Application tracker",
    description: "Track each role through one status pipeline.",
    icon: ClipboardCheck,
  },
  {
    title: "Privacy controls",
    description: "Control what data is stored and shared.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <MarketingShell>
      <LandingHero />

      <section id="benefits" className="container scroll-mt-24 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <Badge className="rounded-full" variant="secondary">
            Outcomes
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            More signal. Less admin.
          </h2>
        </div>
        <div className="space-y-10">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            const isReverse = index % 2 === 1;
            return (
              <div
                key={benefit.title}
                className={`flex flex-col gap-8 lg:items-center ${
                  isReverse ? "lg:flex-row-reverse" : "lg:flex-row"
                }`}
              >
                <div className="flex-1 space-y-4">
                  <h3 className="text-2xl font-semibold text-foreground">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {benefit.points.map((point) => (
                      <div key={point} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="surface-panel flex h-full min-h-[220px] items-center justify-center p-6">
                    <div className="flex h-32 w-32 items-center justify-center rounded-[32px] bg-gradient-to-br from-primary/20 via-white to-accent/20">
                      <Icon className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="features" className="container scroll-mt-24 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <Badge className="rounded-full" variant="secondary">
            Features
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Core product modules.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="surface-card space-y-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-6 px-6 py-10 text-center md:px-10">
          <Badge className="rounded-full" variant="secondary">
            Start now
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Start with your profile.
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Set your profile, review matched roles, and move them through your pipeline.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
