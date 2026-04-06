import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";

const cookieSections = [
  {
    title: "Essential cookies",
    body:
      "These cookies keep you signed in, protect account sessions, and support the basic operation of authenticated product flows.",
  },
  {
    title: "Product analytics",
    body:
      "We may use minimal analytics tooling to understand usage patterns, reliability, and feature adoption. These signals help Omnari Group improve the service rather than target advertising.",
  },
  {
    title: "Your choices",
    body:
      "You can block or clear cookies through your browser settings. Some account and dashboard functionality may not work properly if essential cookies are disabled.",
  },
];

export default function CookiesPage() {
  return (
    <main className="container space-y-10 pb-24 pt-12">
      <div className="space-y-4">
        <Badge className="rounded-full" variant="secondary">
          Legal
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {siteConfig.legalLastUpdated}</p>
      </div>

      <section className="surface-panel space-y-6 p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground">
            {siteConfig.companyName} uses minimal cookies and similar browser storage to operate {siteConfig.name}
            securely and understand basic product usage.
          </p>
        </div>

        <div className="space-y-6">
          {cookieSections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Cookie or consent questions can be sent to{" "}
          <Link href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-primary">
            {siteConfig.supportEmail}
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
