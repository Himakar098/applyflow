import "server-only";

import { HttpError } from "@/lib/auth/verify-id-token";
import {
  calculateProfileCompleteness,
  candidateProfileSchema,
  himakarCandidateProfile,
  type CandidateProfile,
} from "@/lib/job-agent";
import {
  decryptJson,
  encryptJson,
  isEncryptionConfigured,
} from "@/lib/security/encryption";
import type { PrivateContact } from "@/lib/job-agent/server/request-schemas";
import {
  hasMatchingUsableClaim,
  normalizeCandidateClaims,
} from "@/lib/job-agent/server/profile-claims";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  userDocument,
} from "@/lib/job-agent/server/store";

type ProfileRecord = {
  id: "current";
  profile: CandidateProfile;
  encryptedPrivateContact?: string | null;
  createdAt: string;
  updatedAt: string;
};

function assertSensitiveFactGrounding(profile: CandidateProfile) {
  const privateReferenceValues = Object.values(profile.privateContactReferences);
  if (privateReferenceValues.some((value) => !/^[A-Z][A-Z0-9_]{2,100}$/.test(value))) {
    throw new HttpError(422, "Private contact references must be server environment variable names");
  }
  if (profile.claims.some((claim) =>
    claim.sensitive || /(?:email|phone|address|password|token|cookie)/i.test(claim.field),
  )) {
    throw new HttpError(422, "Private contact details must use the encrypted privateContact field");
  }
  const requireFact = (
    label: string,
    claimIds: string[],
    value: unknown,
    expectedCategory: CandidateProfile["claims"][number]["category"],
    expectedField: string,
  ) => {
    const grounded = hasMatchingUsableClaim(
      profile,
      claimIds,
      value,
      expectedCategory,
      expectedField,
    );
    if (!grounded) {
      throw new HttpError(422, `${label} must be backed by a confirmed candidate claim`);
    }
  };

  requireFact(
    "Visa type",
    profile.workRights.claimIds,
    profile.workRights.visa,
    "work-rights",
    "visa",
  );
  requireFact(
    "Visa subclass",
    profile.workRights.claimIds,
    profile.workRights.visaSubclass,
    "work-rights",
    "visaSubclass",
  );
  requireFact(
    "Australian working rights",
    profile.workRights.claimIds,
    profile.workRights.fullWorkingRights,
    "work-rights",
    "fullWorkingRights",
  );

  requireFact(
    "Australian citizenship",
    profile.workRights.claimIds,
    profile.workRights.australianCitizen,
    "work-rights",
    "australianCitizen",
  );
  requireFact(
    "Australian permanent residency",
    profile.workRights.claimIds,
    profile.workRights.australianPermanentResident,
    "work-rights",
    "australianPermanentResident",
  );
  requireFact(
    "Australian driver licence",
    profile.licences.claimIds,
    profile.licences.australianDriverLicence,
    "licence",
    "australianDriverLicence",
  );
  if (profile.workRights.securityClearance) {
    requireFact(
      "Security clearance",
      profile.workRights.claimIds,
      profile.workRights.securityClearance,
      "work-rights",
      "securityClearance",
    );
  }
}

function profileView(profile: CandidateProfile) {
  return {
    profile,
    completeness: calculateProfileCompleteness(profile),
    display: {
      fullName: profile.preferredName,
      location: `${profile.location.city}, ${profile.location.state}`,
      workRights: {
        visaType: profile.workRights.visa,
        fullAustralianWorkRights: profile.workRights.fullWorkingRights,
        permanentResident: profile.workRights.australianPermanentResident,
        requiresSponsorship: profile.workRights.sponsorshipAnswer,
        australianDriverLicence: profile.licences.australianDriverLicence,
      },
    },
  };
}

export async function getCandidateProfileRecord(uid: string) {
  return getRecord<ProfileRecord>(uid, JOB_AGENT_COLLECTIONS.profile, "current");
}

export async function getCandidateProfile(uid: string): Promise<CandidateProfile> {
  const stored = await getCandidateProfileRecord(uid);
  return stored?.profile
    ? candidateProfileSchema.parse(stored.profile)
    : himakarCandidateProfile;
}

export async function readCandidateProfile(uid: string) {
  const stored = await getCandidateProfileRecord(uid);
  const profile = stored?.profile
    ? candidateProfileSchema.parse(stored.profile)
    : himakarCandidateProfile;
  let privateContact: PrivateContact | null = null;

  if (stored?.encryptedPrivateContact) {
    if (!isEncryptionConfigured()) {
      throw new HttpError(503, "Private contact encryption is not configured");
    }
    try {
      privateContact = decryptJson<PrivateContact>(stored.encryptedPrivateContact);
    } catch {
      throw new HttpError(500, "Private contact details could not be decrypted");
    }
  }

  return {
    ...profileView(profile),
    privateContact,
    persisted: Boolean(stored),
    updatedAt: stored?.updatedAt ?? profile.updatedAt,
  };
}

export async function saveCandidateProfile(
  uid: string,
  profileInput: CandidateProfile,
  privateContact?: PrivateContact,
  confirmedClaimIds: string[] = [],
) {
  const now = new Date().toISOString();
  const current = await getCandidateProfileRecord(uid);
  const currentProfile = current?.profile
    ? candidateProfileSchema.parse(current.profile)
    : himakarCandidateProfile;
  const submitted = candidateProfileSchema.parse(profileInput);
  let normalizedClaims: CandidateProfile["claims"];
  try {
    normalizedClaims = normalizeCandidateClaims(
      submitted,
      currentProfile,
      confirmedClaimIds,
      now,
    );
  } catch (error) {
    throw new HttpError(422, error instanceof Error ? error.message : "Candidate claims are invalid");
  }
  const profile = candidateProfileSchema.parse({
    ...submitted,
    claims: normalizedClaims,
    updatedAt: now,
  });
  assertSensitiveFactGrounding(profile);

  const encryptedPrivateContact = privateContact === undefined
    ? current?.encryptedPrivateContact ?? null
    : encryptJson(privateContact);
  const record: ProfileRecord = {
    id: "current",
    profile,
    encryptedPrivateContact,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current").set(record);

  return {
    ...profileView(profile),
    privateContact: privateContact ?? (
      encryptedPrivateContact && isEncryptionConfigured()
        ? decryptJson<PrivateContact>(encryptedPrivateContact)
        : null
    ),
    persisted: true,
    updatedAt: now,
  };
}
