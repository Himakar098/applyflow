export type BetaAccessMode = "open" | "waitlist" | "invite";

function parseAccessMode(value?: string | null): BetaAccessMode {
  if (value === "waitlist" || value === "invite" || value === "open") return value;
  return "open";
}

function parseBoolean(value?: string | null, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const betaConfig = {
  enabled: parseBoolean(process.env.NEXT_PUBLIC_PUBLIC_BETA, false),
  label: process.env.NEXT_PUBLIC_BETA_LABEL || "Access",
  accessMode: parseAccessMode(process.env.NEXT_PUBLIC_BETA_ACCESS_MODE),
  bannerText:
    process.env.NEXT_PUBLIC_BETA_BANNER_TEXT ||
    "Supported-site coverage varies across employer career pages. Review before you submit.",
} as const;

export function getBetaPrimaryCta() {
  if (betaConfig.accessMode === "waitlist") {
    return { href: "/waitlist", label: "Request access" };
  }

  if (betaConfig.accessMode === "invite") {
    return { href: "/register", label: "Enter invite" };
  }

  return { href: "/register", label: "Create account" };
}

export function getBetaSecondaryCta() {
  return { href: "/browser-extension", label: "Extension guide" };
}
