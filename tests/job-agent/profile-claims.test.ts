import { describe, expect, it } from "vitest";

import { himakarCandidateProfile } from "@/lib/job-agent";
import {
  hasMatchingUsableClaim,
  normalizeCandidateClaims,
} from "@/lib/job-agent/server/profile-claims";

const now = "2026-07-18T12:00:00.000Z";

describe("profile claim provenance", () => {
  it("ignores client attempts to self-mark an unchanged server claim", () => {
    const submitted = structuredClone(himakarCandidateProfile);
    const claim = submitted.claims.find((item) => item.id === "citizenship-no")!;
    claim.status = "user-entered";
    claim.source = "attacker-controlled source";
    const normalized = normalizeCandidateClaims(submitted, himakarCandidateProfile, [], now);
    const result = normalized.find((item) => item.id === "citizenship-no")!;
    expect(result.status).toBe("verified");
    expect(result.source).toBe(himakarCandidateProfile.claims.find((item) => item.id === "citizenship-no")!.source);
  });

  it("downgrades changed legal facts until explicit confirmation", () => {
    const submitted = structuredClone(himakarCandidateProfile);
    const claim = submitted.claims.find((item) => item.id === "citizenship-no")!;
    claim.value = true;
    claim.status = "verified";
    expect(normalizeCandidateClaims(submitted, himakarCandidateProfile, [], now)
      .find((item) => item.id === "citizenship-no")?.status).toBe("needs-confirmation");
    expect(normalizeCandidateClaims(submitted, himakarCandidateProfile, ["citizenship-no"], now)
      .find((item) => item.id === "citizenship-no")?.status).toBe("user-entered");
  });

  it("does not allow prohibited claim IDs to be repurposed", () => {
    const submitted = structuredClone(himakarCandidateProfile);
    submitted.claims.find((item) => item.id === "salary-150k-prohibited")!.value = "Allowed";
    expect(() => normalizeCandidateClaims(submitted, himakarCandidateProfile, [], now))
      .toThrow(/cannot be repurposed/i);
  });

  it("does not allow verified or prohibited claims to be deleted", () => {
    const submitted = structuredClone(himakarCandidateProfile);
    submitted.claims = submitted.claims.filter((item) => item.id !== "salary-150k-prohibited");
    expect(() => normalizeCandidateClaims(submitted, himakarCandidateProfile, [], now))
      .toThrow(/cannot be deleted/i);
  });

  it("does not accept an unrelated user claim as citizenship evidence", () => {
    const submitted = structuredClone(himakarCandidateProfile);
    submitted.claims.push({
      id: "fake-personal-claim",
      category: "personal",
      field: "anything",
      value: true,
      status: "verified",
      source: "client",
      sensitive: false,
    });
    const claims = normalizeCandidateClaims(submitted, himakarCandidateProfile, [], now);
    const profile = { ...submitted, claims };
    expect(hasMatchingUsableClaim(
      profile,
      ["fake-personal-claim"],
      true,
      "work-rights",
      "australianCitizen",
    )).toBe(false);
  });
});
