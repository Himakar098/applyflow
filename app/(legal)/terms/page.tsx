import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";

export default function TermsPage() {
  return (
    <main className="container space-y-10 pb-24 pt-12">
      <div className="space-y-4">
        <Badge className="rounded-full" variant="secondary">
          Terms of service
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 4, 2026</p>
      </div>

      <section className="surface-panel space-y-6 p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Agreement</h2>
          <p className="text-sm text-muted-foreground">
            By using ApplyFlow, you agree to these terms. If you do not agree, please do
            not use the service.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Your responsibilities</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Provide accurate profile and resume information.</li>
            <li>Use ApplyFlow only for lawful job-search activities.</li>
            <li>Keep your account credentials secure.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">AI-generated content</h2>
          <p className="text-sm text-muted-foreground">
            ApplyFlow can generate resume bullets and cover letter drafts. You are
            responsible for reviewing and validating all content before submitting
            applications.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Service changes</h2>
          <p className="text-sm text-muted-foreground">
            We may update features or discontinue parts of the service to improve the
            experience. We will make reasonable efforts to communicate significant
            changes.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Contact</h2>
          <p className="text-sm text-muted-foreground">
            Questions about these terms? Email
            {" "}
            <Link
              href={`mailto:${siteConfig.supportEmail}`}
              className="font-semibold text-primary"
            >
              {siteConfig.supportEmail}
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
