import Link from "next/link";
import { BookOpen, FileText, HelpCircle, Puzzle, Sparkles } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const resources = [
  {
    title: "Job Search Playbook",
    description: "Step-by-step guidance to structure your job hunt.",
    icon: BookOpen,
    status: "Coming soon",
  },
  {
    title: "Resume Kit",
    description: "Templates, examples, and best practices for fast edits.",
    icon: FileText,
    status: "Coming soon",
  },
  {
    title: "Interview Prep",
    description: "Common questions, frameworks, and story prompts.",
    icon: Sparkles,
    status: "Coming soon",
  },
  {
    title: "FAQ",
    description: "Answers to the most common ApplyFlow questions.",
    icon: HelpCircle,
    status: "Available now",
  },
  {
    title: "Browser Extension Setup",
    description: "Install steps for Chrome, Edge, and Safari beta users.",
    icon: Puzzle,
    status: "Available now",
    href: "/browser-extension",
  },
];

export default function ResourcesPage() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <Badge className="rounded-full" variant="secondary">
          Resources
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          Resources to keep your job search sharp.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          We&apos;re building a resource hub with guides, templates, and FAQs to support every
          stage of your search.
        </p>
      </section>

      <section className="container grid gap-6 md:grid-cols-2">
        {resources.map((resource) => {
          const Icon = resource.icon;
          const content = (
            <div key={resource.title} className="surface-card space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge className="rounded-full" variant="secondary">
                  {resource.status}
                </Badge>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{resource.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
              </div>
            </div>
          );

          return resource.href ? (
            <Link key={resource.title} href={resource.href} className="block transition hover:-translate-y-0.5">
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-4 px-6 py-10 text-center md:px-10">
          <Badge className="rounded-full" variant="secondary">
            Public beta
          </Badge>
          <h3 className="text-2xl font-semibold text-foreground">Need help right now?</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Public beta users can join the current wave, review extension setup, or reach out
            to the ApplyFlow team for help.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/browser-extension">View extension guide</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`mailto:${siteConfig.supportEmail}`}>Contact support</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
