import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";

const sections = [
  {
    title: "1. What we collect",
    body:
      "ApplyFlow stores the information required to run the workspace: account details, profile fields, resume uploads, saved jobs, application notes, generated application materials, and limited product analytics.",
  },
  {
    title: "2. How we use the data",
    body:
      "Omnari Group uses this information to operate the service, personalize role recommendations, generate tailored application content, secure accounts, troubleshoot issues, and respond to support or legal requests.",
  },
  {
    title: "3. Storage and service providers",
    body:
      "ApplyFlow currently relies on third-party infrastructure providers such as Firebase, Vercel, and related operational tooling. Data is processed only as needed to operate the product and is not sold for advertising or unrelated resale.",
  },
  {
    title: "4. Career-site interactions",
    body:
      "When you use the Apply Assistant or browser extension, the product prepares profile and job context so you can fill employer application forms faster. You remain responsible for reviewing the employer form and deciding what to submit.",
  },
  {
    title: "5. Retention and deletion",
    body:
      "We retain account data while your workspace remains active and for a reasonable period needed for security, compliance, backup, and support. To request deletion or correction, contact us directly.",
  },
  {
    title: "6. Security",
    body:
      "Omnari Group uses reasonable administrative, technical, and organisational safeguards to protect the service. No online system is perfectly secure, so users should also protect their credentials and review the information they choose to store.",
  },
  {
    title: "7. Contact",
    body: `Privacy, deletion, or data-handling questions should be sent to ${siteConfig.supportEmail}.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="container space-y-10 pb-24 pt-12">
      <div className="space-y-4">
        <Badge className="rounded-full" variant="secondary">
          Legal
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {siteConfig.legalLastUpdated}</p>
      </div>

      <section className="surface-panel space-y-6 p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Scope</h2>
          <p className="text-sm text-muted-foreground">
            This policy explains how {siteConfig.companyName} handles information collected through {siteConfig.name}.
            It applies to the public website, account workflows, dashboard, browser-extension-assisted flows, and support requests.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          For privacy requests, email{" "}
          <Link href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-primary">
            {siteConfig.supportEmail}
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
