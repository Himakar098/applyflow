import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
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

const socialProof = [
  "Career Weekly",
  "Productivity Today",
  "Hiring Ops Review",
  "Talent Pulse",
  "Growth Daily",
];

const steps = [
  {
    title: "Set your filters",
    description:
      "Tell ApplyFlow what roles, locations, and preferences you care about so matches stay focused.",
    icon: Filter,
  },
  {
    title: "Upload resume + answer a few questions",
    description:
      "We extract key details and pre-fill your profile so every application starts with clean data.",
    icon: FileText,
  },
  {
    title: "Stay on top of daily apply tasks",
    description:
      "Receive new matches, generate tailored packs, and track your pipeline in one place.",
    icon: CalendarClock,
  },
];

const benefits = [
  {
    title: "Get more interviews",
    description:
      "Focus on roles that truly match your profile with guided discovery and tailored apply packs.",
    points: ["Sharper targeting", "Tailored bullets", "Confidence boosts"],
    icon: Target,
  },
  {
    title: "Never miss a strong opportunity",
    description:
      "Recommendations surface new roles quickly so you can act while the window is open.",
    points: ["Fresh matches", "Follow-up nudges", "Pipeline clarity"],
    icon: Sparkles,
  },
  {
    title: "Apply with confidence",
    description:
      "Every resume bullet and cover letter starts from your real profile and gets tuned for the role.",
    points: ["ATS-ready", "Role-specific", "Easy edits"],
    icon: BadgeCheck,
  },
  {
    title: "Save hours every week",
    description:
      "Your profile data and templates reduce repetitive work so you can focus on the best roles.",
    points: ["Less manual copy", "Reusable assets", "Faster workflows"],
    icon: LineChart,
  },
  {
    title: "Stay organized end-to-end",
    description:
      "Track every application, follow-up, and outcome in one clean workspace.",
    points: ["Status tracking", "Follow-up reminders", "Weekly progress"],
    icon: ClipboardCheck,
  },
];

const features = [
  {
    title: "Profile intelligence",
    description: "Resume parsing and structured profiles that stay up to date.",
    icon: Sparkles,
  },
  {
    title: "Job recommendations",
    description: "Personalized matches based on your skills, goals, and preferences.",
    icon: Target,
  },
  {
    title: "Search workspace",
    description: "Guided filters, saved searches, and curated job feeds.",
    icon: Filter,
  },
  {
    title: "Tailored apply packs",
    description: "ATS-ready resume bullets and cover letters for every role.",
    icon: FileText,
  },
  {
    title: "Application tracker",
    description: "Statuses, notes, follow-ups, and reminders in one view.",
    icon: ClipboardCheck,
  },
  {
    title: "Privacy-first workflow",
    description: "You control what gets shared and when across your applications.",
    icon: ShieldCheck,
  },
];

const testimonials = [
  {
    name: "Jasmine K.",
    role: "Operations Analyst",
    quote:
      "ApplyFlow helped me keep my job search organized and made every application feel sharper.",
  },
  {
    name: "Ethan L.",
    role: "Marketing Coordinator",
    quote:
      "The tailored packs and tracker kept me moving every week without feeling overwhelmed.",
  },
  {
    name: "Priya D.",
    role: "Business Analyst",
    quote:
      "Everything is in one place. I finally know what to apply to next and when to follow up.",
  },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <LandingHero />

      <section className="container space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Badge className="rounded-full" variant="secondary">
            Social proof
          </Badge>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">As seen in</h2>
          <p className="text-sm text-muted-foreground">
            Placeholder logos shown here until real press mentions are ready.
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 pt-2 sm:justify-center">
          {socialProof.map((logo) => (
            <div
              key={logo}
              className="flex min-w-[160px] items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-white/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              {logo}
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="container scroll-mt-24 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <Badge className="rounded-full" variant="secondary">
            How it works
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            A simple flow that keeps you moving.
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            One-time setup, then ApplyFlow keeps your pipeline organized and your applications
            tailored.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="surface-card space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="benefits" className="container scroll-mt-24 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <Badge className="rounded-full" variant="secondary">
            Benefits
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Built to help you apply smarter, not harder.
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Each workflow is designed to keep you focused, organized, and confident as you
            move through the job search.
          </p>
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
            Everything you need in one workspace.
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            ApplyFlow bundles the tools you need for discovery, application, and follow-up.
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

      <section id="testimonials" className="container scroll-mt-24 space-y-10">
        <div className="flex flex-col gap-3 text-center">
          <Badge className="rounded-full" variant="secondary">
            Testimonials
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Job seekers stay with ApplyFlow for the momentum.
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Placeholder testimonials shown until real customer stories are ready.
          </p>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="surface-card min-w-[260px] space-y-4 p-6 md:min-w-0">
              <div className="flex items-center gap-1 text-emerald-500">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <BadgeCheck key={idx} className="h-4 w-4" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">“{testimonial.quote}”</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-6 px-6 py-10 text-center md:px-10">
          <Badge className="rounded-full" variant="secondary">
            Ready to start
          </Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Ready to accelerate your job search?
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build your profile, uncover the right opportunities, and ship tailored
            applications faster.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Start now
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
