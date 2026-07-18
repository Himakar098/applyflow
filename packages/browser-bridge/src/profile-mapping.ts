import type {
  CandidateClaim,
  CandidateProfile,
} from "../../../lib/job-agent/schemas";

import type {
  AutofillValue,
  CandidateAutofillProfile,
  ClaimProvenance,
} from "./types";

type PrivateContact = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
} | null;

const usableStatuses = new Set<CandidateClaim["status"]>([
  "verified",
  "user-entered",
]);

// These declarations are intentionally excluded even when the profile contains
// an explicit negative value. Employer wording and legal meaning vary, so the
// local bridge always leaves them for a per-application human decision.
const prohibitedAutofillKeys = new Set([
  "australianCitizen",
  "citizenship",
  "permanentResident",
  "permanentResidency",
  "australianPermanentResident",
  "securityClearance",
  "australianDriverLicence",
  "driverLicence",
]);

const scalar = (
  value: CandidateClaim["value"],
): value is string | number | boolean => !Array.isArray(value);

const provenanceFor = (claim: CandidateClaim): ClaimProvenance =>
  claim.status === "user-entered" ? "user-entered" : "verified";

function valuesEqual(left: CandidateClaim["value"], right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function usableClaim(
  profile: CandidateProfile,
  fields: readonly string[],
  constraints: {
    category?: CandidateClaim["category"];
    allowedIds?: readonly string[];
    expectedValue?: unknown;
  } = {},
): CandidateClaim | undefined {
  return profile.claims.find(
    (claim) =>
      fields.includes(claim.field) &&
      usableStatuses.has(claim.status) &&
      scalar(claim.value) &&
      (!constraints.category || claim.category === constraints.category) &&
      (!constraints.allowedIds || constraints.allowedIds.includes(claim.id)) &&
      (constraints.expectedValue === undefined ||
        valuesEqual(claim.value, constraints.expectedValue)),
  );
}

function fromClaim(
  claim: CandidateClaim,
  key = claim.field,
  aliases?: string[],
): AutofillValue | null {
  if (prohibitedAutofillKeys.has(key) || !scalar(claim.value)) return null;
  return {
    key,
    value: claim.value,
    sourceLabel: "Confirmed candidate profile claim",
    provenance: provenanceFor(claim),
    aliases,
  };
}

function add(values: AutofillValue[], value: AutofillValue | null | undefined) {
  if (!value || prohibitedAutofillKeys.has(value.key)) return;
  if (!values.some((candidate) => candidate.key === value.key)) values.push(value);
}

/**
 * Builds the narrow scalar profile consumed by deterministic field mapping.
 * Sensitive declarations that can change legal eligibility are deliberately
 * omitted; missing or unconfirmed facts become review pauses, never guesses.
 */
export function toCandidateAutofillProfile(
  profile: CandidateProfile,
  privateContact: PrivateContact,
): CandidateAutofillProfile {
  const values: AutofillValue[] = [];

  if (privateContact?.email) {
    add(values, {
      key: "email",
      value: privateContact.email,
      sourceLabel: "Encrypted private contact",
      provenance: "user-entered",
      aliases: ["emailAddress"],
    });
  }
  if (privateContact?.phone) {
    add(values, {
      key: "phone",
      value: privateContact.phone,
      sourceLabel: "Encrypted private contact",
      provenance: "user-entered",
      aliases: ["phoneNumber", "mobile"],
    });
  }
  if (privateContact?.address) {
    add(values, {
      key: "addressLine1",
      value: privateContact.address,
      sourceLabel: "Encrypted private contact",
      provenance: "user-entered",
      aliases: ["streetAddress"],
    });
  }

  const preferredName = usableClaim(profile, ["preferredName"], {
    category: "personal",
    expectedValue: profile.preferredName,
  });
  if (preferredName) add(values, fromClaim(preferredName, "preferredName"));

  for (const field of [
    "firstName",
    "givenName",
    "lastName",
    "familyName",
    "surname",
    "fullName",
  ] as const) {
    const claim = usableClaim(profile, [field], { category: "personal" });
    if (claim) add(values, fromClaim(claim, field));
  }

  const location = usableClaim(profile, ["location"], {
    category: "location",
    expectedValue: `${profile.location.city}, ${profile.location.state}`,
  });
  if (location) {
    add(values, fromClaim(location, "location"));
    add(values, {
      key: "city",
      value: profile.location.city,
      sourceLabel: "Confirmed candidate location",
      provenance: provenanceFor(location),
      aliases: ["suburb"],
    });
    add(values, {
      key: "state",
      value: profile.location.state,
      sourceLabel: "Confirmed candidate location",
      provenance: provenanceFor(location),
      aliases: ["region"],
    });
    add(values, {
      key: "country",
      value: profile.location.country,
      sourceLabel: "Confirmed candidate location",
      provenance: provenanceFor(location),
    });
  }

  const fullWorkingRights = usableClaim(profile, ["fullWorkingRights"], {
    category: "work-rights",
    allowedIds: profile.workRights.claimIds,
    expectedValue: profile.workRights.fullWorkingRights,
  });
  if (fullWorkingRights) {
    add(values, fromClaim(fullWorkingRights, "workRights"));
  }

  const visa = usableClaim(profile, ["visa"], {
    category: "work-rights",
    allowedIds: profile.workRights.claimIds,
    expectedValue: profile.workRights.visa,
  });
  const visaSubclass = usableClaim(profile, ["visaSubclass"], {
    category: "work-rights",
    allowedIds: profile.workRights.claimIds,
    expectedValue: profile.workRights.visaSubclass,
  });
  if (visa && visaSubclass) {
    add(values, {
      key: "visaStatus",
      value: `${String(visa.value)}, subclass ${String(visaSubclass.value)}`,
      sourceLabel: "Confirmed visa profile claims",
      provenance:
        visa.status === "user-entered" || visaSubclass.status === "user-entered"
          ? "user-entered"
          : "verified",
    });
  }

  const sponsorship = usableClaim(
    profile,
    ["requiresSponsorship", "sponsorship"],
    {
      category: "application-answer",
      allowedIds: profile.workRights.claimIds,
      expectedValue: profile.workRights.sponsorshipAnswer ?? undefined,
    },
  );
  if (sponsorship && profile.workRights.sponsorshipAnswer !== null) {
    add(values, fromClaim(sponsorship, "requiresSponsorship", ["sponsorship"]));
  }

  const noticePeriod = usableClaim(profile, ["noticePeriod"], {
    category: "availability",
    allowedIds: profile.availability.claimIds,
    expectedValue: profile.availability.noticePeriod ?? undefined,
  });
  if (noticePeriod && profile.availability.noticePeriod !== null) {
    add(values, fromClaim(noticePeriod, "noticePeriod"));
  }

  const salary = profile.claims.find(
    (claim) =>
      claim.id === profile.salaryPreference.claimId &&
      claim.category === "salary" &&
      usableStatuses.has(claim.status) &&
      scalar(claim.value),
  );
  if (salary) {
    add(values, fromClaim(salary, "salaryTarget", ["salaryExpectation"]));
  }

  const linkMappings = [
    ["linkedinUrl", "linkedin"],
    ["portfolioUrl", "website", "personalWebsite"],
  ] as const;
  for (const fields of linkMappings) {
    const claim = usableClaim(profile, fields, { category: "link" });
    if (!claim || typeof claim.value !== "string") continue;
    try {
      const url = new URL(claim.value);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      add(values, fromClaim(claim, fields[0], [...fields.slice(1)]));
    } catch {
      // Invalid links stay out of the browser plan.
    }
  }

  return { values };
}
