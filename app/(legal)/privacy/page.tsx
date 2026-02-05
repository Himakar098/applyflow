import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";

export default function PrivacyPage() {
  return (
    <main className="container space-y-10 pb-24 pt-12">
      <div className="space-y-4">
        <Badge className="rounded-full" variant="secondary">
          Privacy policy
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 4, 2026</p>
      </div>

      <section className="surface-panel space-y-6 p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground">
            ApplyFlow helps you build a profile, discover job opportunities, and create
            tailored application materials. This policy explains what data we collect,
            why we collect it, and how you control it.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Information we collect</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Profile details you provide, including resume uploads and form entries.</li>
            <li>Application activity such as saved jobs, statuses, and follow-up notes.</li>
            <li>Usage signals that help us improve the experience, like feature engagement.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">How we use your data</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Personalize recommendations and generate tailored application materials.</li>
            <li>Maintain your application tracker and progress reports.</li>
            <li>Improve product reliability and support.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Sharing and retention</h2>
          <p className="text-sm text-muted-foreground">
            We do not sell your personal information. We may share data with trusted
            service providers that help us operate ApplyFlow, and we retain data only as
            long as needed to provide the service.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Your choices</h2>
          <p className="text-sm text-muted-foreground">
            You can update your profile at any time, delete saved jobs, and control what
            you share. To request data deletion, contact us at
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

        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Contact</h2>
          <p className="text-sm text-muted-foreground">
            Questions about privacy? Email
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
