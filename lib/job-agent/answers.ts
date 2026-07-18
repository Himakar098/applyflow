import {
  proposedApplicationAnswerSchema,
  type CandidateProfile,
  type ProposedApplicationAnswer,
} from "./schemas";

function answer(
  question: string,
  values: Omit<ProposedApplicationAnswer, "question">,
): ProposedApplicationAnswer {
  return proposedApplicationAnswerSchema.parse({ question, ...values });
}

/**
 * Produces a proposal only. Immigration, identity, legal and demographic
 * answers remain review-gated even when the underlying fact is verified.
 */
export function proposeApplicationAnswer(
  question: string,
  profile: CandidateProfile,
): ProposedApplicationAnswer {
  const normalised = question.trim().toLowerCase();

  if (/\b(?:australian citizen|australian citizenship)\b/.test(normalised)) {
    return answer(question, {
      classification: "citizenship",
      proposedValue: profile.workRights.australianCitizen ? "Yes" : "No",
      sourceClaimIds: ["citizenship-no"],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Identity declaration: review the exact portal wording before filling.",
    });
  }

  if (/\b(?:permanent resident|permanent residency)\b/.test(normalised)) {
    return answer(question, {
      classification: "permanent-residency",
      proposedValue: profile.workRights.australianPermanentResident ? "Yes" : "No",
      sourceClaimIds: ["permanent-residency-no"],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Immigration declaration: review the exact portal wording before filling.",
    });
  }

  if (/\b(?:sponsor|sponsorship)\b/.test(normalised)) {
    return answer(question, {
      classification: "sponsorship",
      proposedValue: null,
      sourceClaimIds: ["sponsorship-unconfirmed"],
      confidence: 0,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Sponsorship is not confirmed in the candidate profile and must never be guessed.",
    });
  }

  if (/\b(?:subclass\s*485|temporary graduate|visa status|hold a visa)\b/.test(normalised)) {
    return answer(question, {
      classification: "visa",
      proposedValue: `Yes - Temporary Graduate visa, subclass ${profile.workRights.visaSubclass}`,
      sourceClaimIds: ["work-rights-visa-485"],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Visa declaration: confirm the current visa conditions before filling.",
    });
  }

  if (/\b(?:work(?:ing)? rights?|right to work|legally (?:entitled|authorised|authorized) to work)\b/.test(normalised)) {
    return answer(question, {
      classification: "work-rights",
      proposedValue: profile.workRights.fullWorkingRights
        ? "Yes - full Australian working rights, subject to my current visa conditions"
        : "No",
      sourceClaimIds: ["work-rights-full", "work-rights-visa-485"],
      confidence: 0.95,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Work-right wording may have immigration consequences; user confirmation is required.",
    });
  }

  if (/\b(?:security clearance|baseline clearance|nv1|nv2)\b/.test(normalised)) {
    return answer(question, {
      classification: "security-clearance",
      proposedValue: profile.workRights.securityClearance ? "Yes" : "No",
      sourceClaimIds: ["security-clearance-none"],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Security-clearance declaration requires review.",
    });
  }

  if (/\b(?:australian|local)\s+(?:driver'?s?|driving)\s+licen[cs]e\b/.test(normalised)) {
    return answer(question, {
      classification: "australian-driver-licence",
      proposedValue: profile.licences.australianDriverLicence ? "Yes" : "No",
      sourceClaimIds: ["australian-driver-licence-no"],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Licence declaration requires review; an international licence must not be represented as Australian.",
    });
  }

  if (/\b(?:salary|remuneration|compensation|pay expectation)\b/.test(normalised)) {
    const selected = profile.salaryPreference.selectedAmount;
    const proposedValue = selected === null
      ? `AUD ${profile.salaryPreference.minimum.toLocaleString("en-AU")}-${profile.salaryPreference.maximum.toLocaleString("en-AU")} plus super (target range; confirm for this opportunity)`
      : `AUD ${selected.toLocaleString("en-AU")} plus super`;
    return answer(question, {
      classification: "salary",
      proposedValue,
      sourceClaimIds: [profile.salaryPreference.claimId],
      confidence: selected === null ? 0.7 : 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Salary must be selected for each opportunity before filling.",
    });
  }

  if (/\b(?:notice period|when can you start|availability date|available to start)\b/.test(normalised)) {
    return answer(question, {
      classification: "notice-period",
      proposedValue: profile.availability.noticePeriod,
      sourceClaimIds: ["notice-period-unconfirmed"],
      confidence: profile.availability.noticePeriod ? 1 : 0,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: profile.availability.noticePeriod
        ? "Confirm the current notice period."
        : "Notice period is not configured; user input is required.",
    });
  }

  if (/\b(?:disability|health condition|medical|religion|religious|ethnicity|ethnic|race|gender|sexual orientation|indigenous|aboriginal|torres strait|veteran)\b/.test(normalised)) {
    return answer(question, {
      classification: "sensitive-demographic",
      proposedValue: "Prefer not to say",
      sourceClaimIds: [],
      confidence: 1,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Optional sensitive demographic fields are never filled automatically.",
    });
  }

  if (/\b(?:declare|declaration|certify|attest|legally binding|terms and conditions|privacy consent|consent to)\b/.test(normalised)) {
    return answer(question, {
      classification: "legal-declaration",
      proposedValue: null,
      sourceClaimIds: [],
      confidence: 0,
      requiresUserConfirmation: true,
      autoFillAllowed: false,
      pauseReason: "Unknown legal declaration requires direct user action.",
    });
  }

  return answer(question, {
    classification: "general",
    proposedValue: null,
    sourceClaimIds: [],
    confidence: 0,
    requiresUserConfirmation: true,
    autoFillAllowed: false,
    pauseReason: "[USER INPUT REQUIRED] No verified standard answer matches this question.",
  });
}
