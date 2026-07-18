import { randomUUID } from "node:crypto";

import {
  classifySensitiveField,
  isNeverAutofillCategory,
  normaliseFieldText,
  requiresPerFieldReview,
} from "./safety";
import type {
  AutofillPlan,
  AutofillValue,
  CandidateAutofillProfile,
  FieldMapping,
  FormInspection,
  InspectedField,
  PauseSignal,
} from "./types";

interface MappingRule {
  keys: string[];
  patterns: RegExp[];
  confidence: number;
}

const mappingRules: MappingRule[] = [
  {
    keys: ["email", "emailAddress"],
    patterns: [/\be[ -]?mail\b/, /emailaddress/],
    confidence: 0.99,
  },
  {
    keys: ["phone", "phoneNumber", "mobile"],
    patterns: [/\bphone\b/, /mobile/, /telephone/],
    confidence: 0.98,
  },
  {
    keys: ["firstName", "givenName"],
    patterns: [/first name/, /given name/, /firstname/],
    confidence: 0.99,
  },
  {
    keys: ["lastName", "familyName", "surname"],
    patterns: [/last name/, /family name/, /surname/, /lastname/],
    confidence: 0.99,
  },
  {
    keys: ["preferredName"],
    patterns: [/preferred name/, /known as/],
    confidence: 0.98,
  },
  {
    keys: ["fullName", "name"],
    patterns: [/^name$/, /full name/, /your name/, /candidate name/],
    confidence: 0.93,
  },
  {
    keys: ["linkedinUrl", "linkedin"],
    patterns: [/linkedin/],
    confidence: 0.99,
  },
  {
    keys: ["portfolioUrl", "website", "personalWebsite"],
    patterns: [/portfolio/, /personal website/, /^website$/, /github/],
    confidence: 0.94,
  },
  {
    keys: ["addressLine1", "streetAddress"],
    patterns: [/street address/, /address line 1/, /^address$/],
    confidence: 0.91,
  },
  {
    keys: ["city", "suburb"],
    patterns: [/\bcity\b/, /suburb/],
    confidence: 0.95,
  },
  {
    keys: ["state", "region"],
    patterns: [/\bstate\b/, /state\/territory/, /province/, /region/],
    confidence: 0.93,
  },
  {
    keys: ["postcode", "postalCode"],
    patterns: [/post ?code/, /postal code/, /zip code/],
    confidence: 0.98,
  },
  {
    keys: ["country"],
    patterns: [/\bcountry\b/],
    confidence: 0.97,
  },
  {
    keys: ["location"],
    patterns: [/current location/, /^location$/, /where are you based/],
    confidence: 0.9,
  },
  {
    keys: ["workRights"],
    patterns: [
      /work rights/,
      /working rights/,
      /right to work/,
      /authori[sz]ed to work/,
      /work authori[sz]ation/,
    ],
    confidence: 0.9,
  },
  {
    keys: ["visaStatus"],
    patterns: [/visa status/, /current visa/, /immigration status/],
    confidence: 0.9,
  },
  {
    keys: ["requiresSponsorship", "sponsorship"],
    patterns: [/require sponsorship/, /need sponsorship/, /sponsor you/],
    confidence: 0.86,
  },
  {
    keys: ["australianCitizen", "citizenship"],
    patterns: [/australian citizen/, /citizenship/],
    confidence: 0.91,
  },
  {
    keys: ["permanentResident", "permanentResidency"],
    patterns: [/permanent resident/, /permanent residency/],
    confidence: 0.91,
  },
  {
    keys: ["securityClearance"],
    patterns: [/security clearance/, /baseline clearance/, /\bnv1\b/, /\bnv2\b/],
    confidence: 0.94,
  },
  {
    keys: ["australianDriverLicence", "driverLicence"],
    patterns: [/driver licence/, /driver license/, /driving licence/],
    confidence: 0.91,
  },
  {
    keys: ["salaryTarget", "salaryExpectation"],
    patterns: [/salary/, /remuneration/, /compensation/, /pay expectation/],
    confidence: 0.89,
  },
  {
    keys: ["availability", "startDate"],
    patterns: [/availability/, /available to start/, /start date/],
    confidence: 0.87,
  },
  {
    keys: ["noticePeriod"],
    patterns: [/notice period/, /how much notice/],
    confidence: 0.94,
  },
  {
    keys: ["resumePath"],
    patterns: [/resume/, /résumé/, /\bcv\b/, /curriculum vitae/],
    confidence: 0.99,
  },
  {
    keys: ["coverLetterPath"],
    patterns: [/cover letter/, /covering letter/],
    confidence: 0.99,
  },
];

const normaliseKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

function profileValues(profile: CandidateAutofillProfile): AutofillValue[] {
  const values = [...profile.values];

  if (profile.documents?.resumePath) {
    values.push({
      key: "resumePath",
      value: profile.documents.resumePath,
      sourceLabel: "User-selected resume",
      provenance: "user-entered",
      aliases: ["resume", "cv"],
    });
  }

  if (profile.documents?.coverLetterPath) {
    values.push({
      key: "coverLetterPath",
      value: profile.documents.coverLetterPath,
      sourceLabel: "User-selected cover letter",
      provenance: "user-entered",
      aliases: ["cover letter", "covering letter"],
    });
  }

  return values;
}

function sourceForKeys(
  values: AutofillValue[],
  keys: string[],
): AutofillValue | undefined {
  const targetKeys = new Set(keys.map(normaliseKey));

  return values.find((candidate) => {
    const candidateKeys = [candidate.key, ...(candidate.aliases ?? [])].map(
      normaliseKey,
    );
    return candidateKeys.some((key) => targetKeys.has(key));
  });
}

function pauseForBlockedField(field: InspectedField): PauseSignal {
  switch (field.sensitiveCategory) {
    case "legal_attestation":
      return {
        code: "LEGAL_ATTESTATION",
        message: `Manual action is required for legal declaration: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    case "identity":
      return {
        code: "IDENTITY_DECLARATION",
        message: `Identity information is never filled automatically: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    case "demographic":
    case "diversity":
      return {
        code: "SENSITIVE_DEMOGRAPHIC_FIELD",
        message: `Sensitive demographic or diversity question requires manual action: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
    default:
      return {
        code: "UNKNOWN_REQUIRED_QUESTION",
        message: `No verified answer is available for required field: ${field.label}`,
        fieldId: field.id,
        severity: "pause",
      };
  }
}

export function mapField(
  inspectedField: InspectedField,
  profile: CandidateAutofillProfile,
): FieldMapping {
  const sensitiveCategory =
    inspectedField.sensitiveCategory === "none"
      ? classifySensitiveField(inspectedField)
      : inspectedField.sensitiveCategory;
  const field = {
    ...inspectedField,
    sensitiveCategory,
    reviewRequired:
      inspectedField.reviewRequired || requiresPerFieldReview(sensitiveCategory),
  };

  if (field.kind === "password" || isNeverAutofillCategory(sensitiveCategory)) {
    return {
      field,
      confidence: 1,
      reviewRequired: true,
      status: "blocked",
      reason: "This category is reserved for manual completion.",
    };
  }

  const text = normaliseFieldText(field);
  const rule = mappingRules.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(text)),
  );

  if (!rule) {
    return {
      field,
      confidence: 0,
      reviewRequired: field.required,
      status: "no_match",
      reason: "No deterministic candidate-profile mapping matched this field.",
    };
  }

  const source = sourceForKeys(profileValues(profile), rule.keys);

  if (!source) {
    return {
      field,
      profileKey: rule.keys[0],
      confidence: rule.confidence,
      reviewRequired: field.required || field.reviewRequired,
      status: "no_match",
      reason: "The matching candidate-profile value is not configured.",
    };
  }

  if (source.provenance === "prohibited-from-inference") {
    return {
      field,
      profileKey: source.key,
      sourceLabel: source.sourceLabel,
      provenance: source.provenance,
      confidence: rule.confidence,
      reviewRequired: true,
      status: "blocked",
      reason: "This claim is prohibited from inference and cannot be autofilled.",
    };
  }

  const reviewRequired =
    field.reviewRequired || source.provenance === "needs-confirmation";

  return {
    field,
    profileKey: source.key,
    proposedValue: source.value,
    sourceLabel: source.sourceLabel,
    provenance: source.provenance,
    confidence: rule.confidence,
    reviewRequired,
    status: reviewRequired ? "needs_review" : "ready",
    reason: reviewRequired
      ? "The field has legal, eligibility, or candidate-confirmation consequences."
      : undefined,
  };
}

export function buildAutofillPlan(
  applicationId: string,
  inspection: FormInspection,
  profile: CandidateAutofillProfile,
  now = new Date(),
): AutofillPlan {
  const mappings = inspection.fields.map((field) => mapField(field, profile));
  const pauses = [...inspection.pauses];

  for (const mapping of mappings) {
    if (mapping.status === "blocked") {
      pauses.push(pauseForBlockedField(mapping.field));
      continue;
    }

    if (mapping.status === "no_match" && mapping.field.required) {
      pauses.push(pauseForBlockedField(mapping.field));
      continue;
    }

    if (mapping.status === "needs_review") {
      pauses.push({
        code: "USER_REVIEW_REQUIRED",
        message: `Review the proposed answer before autofill: ${mapping.field.label}`,
        fieldId: mapping.field.id,
        severity: "review",
      });
    }
  }

  const uniquePauses = pauses.filter(
    (pause, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === pause.code && candidate.fieldId === pause.fieldId,
      ) === index,
  );

  return {
    id: randomUUID(),
    applicationId,
    url: inspection.url,
    portal: inspection.portal,
    createdAt: now.toISOString(),
    state: "READY_FOR_REVIEW",
    mappings,
    pauses: uniquePauses,
    submitControls: inspection.submitControls,
  };
}
