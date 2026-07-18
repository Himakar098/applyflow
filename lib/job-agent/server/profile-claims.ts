import type { CandidateProfile } from "@/lib/job-agent";

const LEGAL_CLAIM_CATEGORIES = new Set(["work-rights", "licence"]);

function claimValueMatches(value: unknown, expected: unknown) {
  if (typeof value === "string" && typeof expected === "string") {
    return value.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return value === expected;
}

export function hasMatchingUsableClaim(
  profile: CandidateProfile,
  claimIds: string[],
  value: unknown,
  expectedCategory: CandidateProfile["claims"][number]["category"],
  expectedField: string,
) {
  const claims = new Map(profile.claims.map((claim) => [claim.id, claim]));
  return claimIds.some((claimId) => {
    const claim = claims.get(claimId);
    return claim
      && (claim.status === "verified" || claim.status === "user-entered")
      && claim.category === expectedCategory
      && claim.field === expectedField
      && claimValueMatches(claim.value, value);
  });
}

function sameClaimFact(
  left: CandidateProfile["claims"][number],
  right: CandidateProfile["claims"][number],
) {
  return left.category === right.category
    && left.field === right.field
    && JSON.stringify(left.value) === JSON.stringify(right.value)
    && left.sensitive === right.sensitive;
}

/** Client-supplied provenance is never trusted as verification evidence. */
export function normalizeCandidateClaims(
  submitted: CandidateProfile,
  current: CandidateProfile,
  confirmedClaimIds: string[],
  now: string,
) {
  const currentClaims = new Map(current.claims.map((claim) => [claim.id, claim]));
  const submittedIds = new Set(submitted.claims.map((claim) => claim.id));
  for (const claim of current.claims) {
    if (
      (claim.status === "verified" || claim.status === "prohibited-from-inference")
      && !submittedIds.has(claim.id)
    ) {
      throw new Error(`Protected claim ${claim.id} cannot be deleted`);
    }
  }
  const confirmed = new Set(confirmedClaimIds);
  return submitted.claims.map((claim) => {
    const previous = currentClaims.get(claim.id);
    if (previous?.status === "prohibited-from-inference") {
      if (!sameClaimFact(claim, previous)) {
        throw new Error(`Protected claim ${claim.id} cannot be repurposed`);
      }
      return previous;
    }
    if (previous && sameClaimFact(claim, previous)) return previous;

    const needsExplicitConfirmation = LEGAL_CLAIM_CATEGORIES.has(claim.category);
    const isConfirmed = confirmed.has(claim.id);
    return {
      ...claim,
      status: needsExplicitConfirmation && !isConfirmed
        ? "needs-confirmation" as const
        : "user-entered" as const,
      source: "ApplyFlow candidate profile editor",
      evidence: undefined,
      sensitive: false,
      lastConfirmedAt: isConfirmed || !needsExplicitConfirmation ? now : undefined,
    };
  });
}
