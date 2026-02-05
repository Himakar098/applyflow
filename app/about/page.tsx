import Link from "next/link";
import { ShieldCheck, Sparkles, Target } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const values = [
  {
    title: "Momentum over noise",
    description: "We focus on the actions that move your job search forward every day.",
    icon: Target,
  },
  {
    title: "Human-first AI",
    description: "AI supports your decisions instead of replacing your judgment.",
    icon: Sparkles,
  },
  {
    title: "Privacy by design",
    description: "You control what gets shared and when across your applications.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <Badge className="rounded-full" variant="secondary">
          About ApplyFlow
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          A career OS built for modern job seekers.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          ApplyFlow turns your resume into a living profile, helps you discover the right
          opportunities, and keeps every application organized from first click to offer.
        </p>
      </section>

      <section className="container">
        <div className="surface-panel grid gap-6 px-6 py-10 md:grid-cols-2 md:px-10">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Our mission</h2>
            <p className="text-sm text-muted-foreground">
              We want to remove the chaos from job searching. ApplyFlow gives you a
              structured workspace to build your profile, refine your story, and apply to
              opportunities with confidence.
            </p>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Who it&apos;s for</h2>
            <p className="text-sm text-muted-foreground">
              ApplyFlow is designed for early to mid-career professionals across industries
              who want a clearer, faster path to interviews.
            </p>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 md:grid-cols-3">
        {values.map((value) => {
          const Icon = value.icon;
          return (
            <div key={value.title} className="surface-card space-y-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{value.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-4 px-6 py-10 text-center md:px-10">
          <h3 className="text-2xl font-semibold text-foreground">Ready to build momentum?</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create your ApplyFlow workspace in minutes and start moving toward interviews.
          </p>
          <Button asChild>
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
