import {
  eligibilityAssessmentSchema,
  type CandidateProfile,
  type EligibilityAssessment,
  type JobRequirement,
  type StructuredJob,
} from "./schemas";

export type AssessEligibilityOptions = {
  assessedAt?: string;
};

function isRequired(requirement: JobRequirement): boolean {
  return requirement.importance === "required"
    || /\b(?:must|required|essential|mandatory|condition of employment|only)\b/i.test(requirement.text);
}

function negatesRequirement(text: string, subject: RegExp): boolean {
  return new RegExp(`(?:not|isn't|is not|no)\\s+(?:an?\\s+)?(?:${subject.source})[^.]{0,20}(?:required|necessary)`, "i").test(text)
    || new RegExp(`(?:${subject.source})[^.]{0,20}(?:not required|not necessary)`, "i").test(text);
}

function reason(
  code: string,
  message: string,
  requirement: JobRequirement,
  blocking: boolean,
) {
  return {
    code,
    message,
    excerpt: requirement.excerpt,
    blocking,
  };
}

function profileSearchText(profile: CandidateProfile): string {
  return [
    ...profile.education.flatMap((item) => [item.qualification, item.institution, ...item.details]),
    ...profile.claims
      .filter((claim) => claim.status === "verified" || claim.status === "user-entered")
      .flatMap((claim) => Array.isArray(claim.value) ? claim.value : [String(claim.value)]),
  ].join(" ").toLowerCase();
}

function hasRequiredQualification(profile: CandidateProfile, requirementText: string): boolean | "ambiguous" {
  const text = requirementText.toLowerCase();
  const evidence = profileSearchText(profile);
  if (/\b(?:phd|doctorate)\b/.test(text)) return /\b(?:phd|doctorate)\b/.test(evidence);
  if (/\bmaster'?s? degree\b/.test(text)) {
    if (!/\bmaster\b/.test(evidence)) return false;
    if (/\b(?:nursing|medicine|law|accounting|psychology|social work|pharmacy|architecture)\b/.test(text)) return false;
    if (/\bdata science\b/.test(text)) return true;
    if (/\b(?:related|equivalent|quantitative|stem)\b/.test(text) && /\b(?:data|analytics|computer science|artificial intelligence|machine learning|engineering)\b/.test(text)) return true;
    if (/\b(?:computer science|artificial intelligence|machine learning|engineering)\b/.test(text)) return false;
    if (/\b(?:data|analytics)\b/.test(text)) return true;
    return "ambiguous";
  }
  if (/\bbachelor'?s? degree\b|\bdegree\b/.test(text)) {
    if (!/\b(?:bachelor|master)\b/.test(evidence)) return false;
    if (/\b(?:nursing|medicine|law|accounting|psychology|social work|pharmacy|architecture)\b/.test(text)) {
      return false;
    }
    if (/\b(?:data science|engineering|electronics|communications?)\b/.test(text)) return true;
    if (/\b(?:related|equivalent|quantitative|stem)\b/.test(text) && /\b(?:data|analytics|computer science|information technology|artificial intelligence|machine learning|engineering)\b/.test(text)) return true;
    if (/\b(?:computer science|information technology|artificial intelligence|machine learning)\b/.test(text)) return false;
    if (/\b(?:data|analytics)\b/.test(text)) return true;
    return "ambiguous";
  }
  return "ambiguous";
}

function hasRegistration(profile: CandidateProfile, requirementText: string): boolean {
  const registrationClaims = profile.claims.filter(
    (claim) => claim.category === "certification"
      && (claim.status === "verified" || claim.status === "user-entered"),
  );
  const requiredTokens = requirementText
    .toLowerCase()
    .match(/\b(?:ahpra|cpa|ca|chartered accountant|registered engineer|professional registration)\b/g) ?? [];
  return requiredTokens.some((token) =>
    registrationClaims.some((claim) => String(claim.value).toLowerCase().includes(token)),
  );
}

function isTemporaryVisaFriendly(text: string): boolean {
  return /\b(?:temporary visa(?:s)? (?:accepted|welcome|holders)|subclass 485|485 visa|valid Australian visa|full (?:Australian )?work(?:ing)? rights?|right to work in Australia)\b/i.test(text)
    && !/\b(?:citizen|citizenship|permanent resident|permanent residency|unrestricted|without sponsorship)\b/i.test(text);
}

function hasTemporaryVisaAlternative(text: string): boolean {
  return /\b(?:citizens?|citizenship|permanent residents?|permanent residency)\b[^.\n]{0,140}\b(?:or|and\/or)\b[^.\n]{0,80}\b(?:valid visa|temporary visa|visa holder|work(?:ing)? rights?)\b/i.test(text)
    || /\b(?:valid visa|temporary visa|visa holder|work(?:ing)? rights?)\b[^.\n]{0,80}\b(?:or|and\/or)\b[^.\n]{0,140}\b(?:citizens?|citizenship|permanent residents?|permanent residency)\b/i.test(text);
}

/** Deterministic hard gate. AI output must never replace this result. */
export function assessJobEligibility(
  job: StructuredJob,
  profile: CandidateProfile,
  options: AssessEligibilityOptions = {},
): EligibilityAssessment {
  const blockingReasons: EligibilityAssessment["reasons"] = [];
  const reviewReasons: EligibilityAssessment["reasons"] = [];
  const informationalReasons: EligibilityAssessment["reasons"] = [];

  for (const requirement of job.requirements) {
    const required = isRequired(requirement);
    const text = requirement.text;

    if (
      requirement.category === "citizenship"
      && required
      && !profile.workRights.australianCitizen
      && !negatesRequirement(text, /Australian (?:citizens?|citizenship)/)
      && !hasTemporaryVisaAlternative(text)
    ) {
      blockingReasons.push(reason(
        "AUSTRALIAN_CITIZENSHIP_REQUIRED",
        "The role explicitly requires Australian citizenship, which the candidate does not hold.",
        requirement,
        true,
      ));
      continue;
    }

    if (
      requirement.category === "permanent-residency"
      && required
      && !profile.workRights.australianPermanentResident
      && !negatesRequirement(text, /Australian permanent (?:residents?|residency)/)
      && !hasTemporaryVisaAlternative(text)
    ) {
      blockingReasons.push(reason(
        "AUSTRALIAN_PERMANENT_RESIDENCY_REQUIRED",
        "The role explicitly requires Australian permanent residency, which the candidate does not hold.",
        requirement,
        true,
      ));
      continue;
    }

    if (requirement.category === "security-clearance" && required) {
      const clearance = text.match(/\b(?:NV1|NV2|baseline(?: security)? clearance|security clearance)\b/i)?.[0]
        ?? "security clearance";
      const candidateClearance = profile.workRights.securityClearance?.toLowerCase();
      if (!candidateClearance || !candidateClearance.includes(clearance.toLowerCase())) {
        blockingReasons.push(reason(
          "UNAVAILABLE_SECURITY_CLEARANCE_REQUIRED",
          `The role explicitly requires ${clearance}, which is not held by the candidate.`,
          requirement,
          true,
        ));
      }
      continue;
    }

    if (
      requirement.category === "driver-licence"
      && required
      && /\bAustralian\b/i.test(text)
      && !profile.licences.australianDriverLicence
    ) {
      blockingReasons.push(reason(
        "AUSTRALIAN_DRIVER_LICENCE_REQUIRED",
        "An Australian driver licence is an essential condition, and the candidate does not hold one.",
        requirement,
        true,
      ));
      continue;
    }

    if (requirement.category === "professional-registration" && required) {
      if (!hasRegistration(profile, text)) {
        blockingReasons.push(reason(
          "MISSING_MANDATORY_REGISTRATION",
          "The role requires a professional registration that is not present in verified candidate evidence.",
          requirement,
          true,
        ));
      }
      continue;
    }

    if (requirement.category === "education" && required) {
      const qualification = hasRequiredQualification(profile, text);
      if (qualification === false) {
        blockingReasons.push(reason(
          "MISSING_MANDATORY_QUALIFICATION",
          "The role requires a qualification that is not present in verified candidate evidence.",
          requirement,
          true,
        ));
      } else if (qualification === "ambiguous") {
        reviewReasons.push(reason(
          "QUALIFICATION_RELEVANCE_NEEDS_REVIEW",
          "The qualification wording is not specific enough for a deterministic match.",
          requirement,
          false,
        ));
      }
      continue;
    }

    if (requirement.category === "work-rights") {
      if (
        (isTemporaryVisaFriendly(text) || hasTemporaryVisaAlternative(text))
        && profile.workRights.fullWorkingRights
      ) {
        informationalReasons.push(reason(
          "CURRENT_WORK_RIGHTS_MATCH",
          "The stated work-right requirement matches the candidate's verified current working rights.",
          requirement,
          false,
        ));
      } else {
        reviewReasons.push(reason(
          "WORK_RIGHTS_WORDING_AMBIGUOUS",
          "The work-right or sponsorship wording could have immigration consequences and needs user review.",
          requirement,
          false,
        ));
      }
      continue;
    }

    if (
      requirement.category === "driver-licence"
      && required
      && !/\bAustralian\b/i.test(text)
      && !profile.licences.australianDriverLicence
    ) {
      reviewReasons.push(reason(
        "DRIVER_LICENCE_JURISDICTION_NEEDS_REVIEW",
        "A mandatory driver-licence requirement does not state whether an international licence is accepted.",
        requirement,
        false,
      ));
    }
  }

  const decision = blockingReasons.length > 0
    ? "ineligible" as const
    : reviewReasons.length > 0
      ? "needs_review" as const
      : "eligible" as const;

  return eligibilityAssessmentSchema.parse({
    jobId: job.id,
    candidateProfileId: profile.id,
    decision,
    reasons: [...blockingReasons, ...reviewReasons, ...informationalReasons],
    assessedAt: options.assessedAt ?? "1970-01-01T00:00:00.000Z",
    deterministic: true,
  });
}
