import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site-config";

const sections = [
  {
    title: "1. Ownership",
    body:
      "ApplyFlow is developed and owned by Omnari Group. Access to the product gives you a limited right to use the service; it does not transfer ownership of the software, workflows, brand, or related intellectual property.",
  },
  {
    title: "2. Acceptable use",
    body:
      "You must use the service lawfully, keep your account credentials secure, and avoid using the platform to impersonate others, submit misleading application content, abuse employer systems, or interfere with service reliability.",
  },
  {
    title: "3. User responsibility for submissions",
    body:
      "You are responsible for reviewing all profile data, generated text, and employer-form content before submission. ApplyFlow may help prepare or autofill content, but final submission decisions remain yours.",
  },
  {
    title: "4. Third-party services and employer sites",
    body:
      "Job boards, employer career pages, applicant-tracking systems, and browser vendors are third-party services outside Omnari Group's control. Availability, site structure, CAPTCHA, MFA, login walls, or anti-bot measures may limit what the product can do.",
  },
  {
    title: "5. Service availability and changes",
    body:
      "We may update, suspend, or remove features to improve reliability, security, or legal compliance. We aim to communicate material changes, but the service is provided on an evolving basis and may change without notice.",
  },
  {
    title: "6. Warranty and liability",
    body:
      "To the extent permitted by law, ApplyFlow is provided on an 'as is' and 'as available' basis. Omnari Group does not guarantee employer-site compatibility, uninterrupted availability, or hiring outcomes, and is not liable for indirect or consequential loss arising from use of the service.",
  },
  {
    title: "7. Governing law",
    body:
      "These terms are governed by the laws of Western Australia. Any dispute relating to the service will be subject to the courts of Western Australia unless Omnari Group agrees otherwise in writing.",
  },
];

export default function TermsPage() {
  return (
    <main className="container space-y-10 pb-24 pt-12">
      <div className="space-y-4">
        <Badge className="rounded-full" variant="secondary">
          Legal
        </Badge>
        <h1 className="text-4xl font-semibold text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {siteConfig.legalLastUpdated}</p>
      </div>

      <section className="surface-panel space-y-6 p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Agreement</h2>
          <p className="text-sm text-muted-foreground">
            These terms govern your access to {siteConfig.name}. By using the service, you agree to these terms and to the
            related privacy and cookie policies.
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
          Legal or licensing questions should be sent to{" "}
          <Link href={`mailto:${siteConfig.supportEmail}`} className="font-semibold text-primary">
            {siteConfig.supportEmail}
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
