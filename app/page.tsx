import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { LandingHero } from "@/components/marketing/landing-hero";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";

const workflowCards = [
  {
    title: "Profile setup",
    description:
      "Import resume details, fill any gaps, and keep one structured profile for reuse.",
    points: ["Resume import", "Editable profile", "Location preferences"],
    icon: Sparkles,
  },
  {
    title: "Role selection",
    description:
      "Review matched roles, search directly, and focus on current openings that fit.",
    points: ["Matched roles", "Recent jobs", "Clear filters"],
    icon: Target,
  },
  {
    title: "Application prep",
    description:
      "Generate tailored materials and keep reusable answers ready before you apply.",
    points: ["Tailored packs", "Saved answers", "Less repetition"],
    icon: FileText,
  },
  {
    title: "Tracking",
    description:
      "Track active roles, notes, and next steps without switching tools.",
    points: ["Single tracker", "Status updates", "Action queue"],
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

      <section id="benefits" className="container scroll-mt-24 space-y-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            What the product actually helps with.
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            ApplyFlow is for candidates who want one place to manage profile data,
            review relevant roles, prepare materials, and keep their application
            pipeline organized.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {workflowCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="surface-card space-y-5 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {card.points.map((point) => (
                    <div key={point} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        {point}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="features" className="container scroll-mt-24 space-y-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Core product modules.
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            These are the main surfaces currently available in the app.
          </p>
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
