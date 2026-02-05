export const siteConfig = {
  name: "ApplyFlow",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support.applyflow@gmail.com",
  tagline: "AI-powered job application workspace",
  description:
    "ApplyFlow turns your resume into a living profile, recommends jobs, and generates tailored resume + cover letter packs to help you apply faster.",
} as const;
