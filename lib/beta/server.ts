import type { BetaAccessMode } from "@/lib/beta/config";

function parseAccessMode(value?: string | null): BetaAccessMode {
  if (value === "waitlist" || value === "invite" || value === "open") return value;
  return "open";
}

export function getServerBetaAccessMode(): BetaAccessMode {
  return parseAccessMode(process.env.BETA_ACCESS_MODE || process.env.NEXT_PUBLIC_BETA_ACCESS_MODE);
}

export function getPublicBetaAccessMode(): BetaAccessMode {
  return parseAccessMode(process.env.NEXT_PUBLIC_BETA_ACCESS_MODE);
}

export function getBetaModeConsistency() {
  const rawServer = process.env.BETA_ACCESS_MODE;
  const rawPublic = process.env.NEXT_PUBLIC_BETA_ACCESS_MODE;
  const serverMode = getServerBetaAccessMode();
  const publicMode = getPublicBetaAccessMode();
  const hasExplicitMismatch = Boolean(rawServer && rawPublic && serverMode !== publicMode);

  return {
    ok: !hasExplicitMismatch,
    serverMode,
    publicMode,
    hasExplicitMismatch,
  } as const;
}

export function isInviteCodeValid(code: string) {
  const source = process.env.BETA_INVITE_CODES || "";
  const normalized = code.trim().toLowerCase();
  if (!normalized) return false;
  const allowed = source
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(normalized);
}
