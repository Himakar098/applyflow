const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const configuredSupportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

const defaultSupportEmail = "support@omnari.world";
const legacySupportEmail = "support.applyflow@gmail.com";
const legacySiteUrl = "https://applyflow.com";
const productionFallbackUrl = "https://applyflow-theta.vercel.app";

export const siteConfig = {
  name: "ApplyFlow",
  shortName: "ApplyFlow",
  companyName: "Omnari Group",
  companyUrl: "https://omnari.world",
  productOverviewUrl: "https://omnari.world/apply-flow",
  url:
    configuredSiteUrl && configuredSiteUrl.length > 0
      ? configuredSiteUrl === legacySiteUrl
        ? productionFallbackUrl
        : configuredSiteUrl
      : "http://localhost:3000",
  supportEmail:
    configuredSupportEmail && configuredSupportEmail !== legacySupportEmail
      ? configuredSupportEmail
      : defaultSupportEmail,
  tagline: "Job search workspace by Omnari Group",
  description:
    "ApplyFlow is a job search workspace by Omnari Group for profile building, role recommendations, tailored application materials, and structured application tracking.",
  legalLastUpdated: "April 6, 2026",
} as const;
