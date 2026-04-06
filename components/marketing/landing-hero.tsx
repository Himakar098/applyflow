import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const heroPoints = [
  "Resume-based profile setup",
  "Matched roles and tailored materials",
  "One tracker for active applications",
];

export function LandingHero() {
  const primary = getBetaPrimaryCta();

  return (
    <section className="relative overflow-hidden pb-10 pt-14 md:pb-14 md:pt-20">
      <div className="absolute -top-36 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute right-[-140px] top-12 h-[280px] w-[280px] rounded-full bg-emerald-400/20 blur-[120px]" />
      <div className="absolute bottom-[-140px] left-[-140px] h-[280px] w-[280px] rounded-full bg-accent/30 blur-[120px]" />

      <div className="container relative z-10">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <p className="text-sm font-medium text-primary">
            {siteConfig.name} by {siteConfig.companyName}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            One workspace for your entire job search.
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Build your profile from your resume, review matched roles, generate tailored
            materials, and keep every active application in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={primary.href}>
                {primary.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Login</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {heroPoints.map((point) => (
              <div key={point} className="chip bg-white/85">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
