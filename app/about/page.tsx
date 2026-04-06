import Link from "next/link";
import { ShieldCheck, Sparkles, Target } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { getBetaPrimaryCta } from "@/lib/beta/config";
import { siteConfig } from "@/lib/site-config";

const values = [
  {
    title: "Clear workflow",
    description: "Reduce the number of tools, tabs, and repeated steps involved in a job search.",
    icon: Target,
  },
  {
    title: "Practical AI",
    description: "Use AI to prepare materials and organize work, not to remove human review.",
    icon: Sparkles,
  },
  {
    title: "Controlled data use",
    description: "Keep profile, document, and application data inside a product with explicit ownership and policies.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  const primaryCta = getBetaPrimaryCta();

  return (
    <MarketingShell>
      <section className="container space-y-4 pt-6 text-center">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          ApplyFlow is built by {siteConfig.companyName}.
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          The product exists to make job-search work more structured: one profile,
          one tracker, and a cleaner path from role review to application submission.
        </p>
      </section>

      <section className="container grid gap-6 md:grid-cols-2">
        <div className="surface-panel space-y-4 p-8">
          <h2 className="text-2xl font-semibold text-foreground">What the product covers</h2>
          <p className="text-sm text-muted-foreground">
            ApplyFlow combines profile setup, matched roles, tailored application materials,
            and structured tracking in one workspace. It is meant to reduce admin work and keep
            active applications visible.
          </p>
        </div>
        <div className="surface-panel space-y-4 p-8">
          <h2 className="text-2xl font-semibold text-foreground">How Omnari handles it</h2>
          <p className="text-sm text-muted-foreground">
            ApplyFlow is operated under the Omnari Group banner, with support, legal documents,
            and product ownership handled through the same company contact path.
          </p>
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
                <h2 className="text-lg font-semibold text-foreground">{value.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="container">
        <div className="surface-panel flex flex-col items-center gap-4 px-6 py-10 text-center md:px-10">
          <h2 className="text-2xl font-semibold text-foreground">Ready to use the workspace?</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create an account, import your resume, and start working inside one structured pipeline.
          </p>
          <Button asChild>
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
