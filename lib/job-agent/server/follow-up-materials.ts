import { z } from "zod";

import type {
  Application,
  CandidateProfile,
  StructuredJob,
} from "@/lib/job-agent";

const jobEvidenceFieldSchema = z.enum([
  "originalDescription",
  "company",
  "title",
  "responsibilities",
  "requiredSkills",
  "requiredExperience",
  "selectionCriteria",
  "technologyStack",
]);

const applicationEvidenceFieldSchema = z.enum([
  "company",
  "role",
  "status",
  "dateApplied",
  "contactPerson",
  "interviewStages",
]);

const jobEvidenceSchema = z.object({
  field: jobEvidenceFieldSchema,
  value: z.string().trim().min(1).max(1_000),
  source: z.enum(["explicit", "inferred", "unknown"]),
  excerpts: z.array(z.string().trim().min(1).max(2_000)).max(8),
  confidence: z.number().min(0).max(1),
});

export const groundedFollowUpTextSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  evidenceClaimIds: z.array(z.string().trim().min(1)).min(1).max(20),
  jobEvidence: z.array(jobEvidenceSchema).min(1).max(12),
  applicationEvidenceFields: z.array(applicationEvidenceFieldSchema).min(1).max(8),
  requiresUserReview: z.literal(true),
  factsNeedingConfirmation: z.array(z.string().trim().min(1).max(500)).max(12),
});

const messageDraftSchema = z.object({
  subject: z.string().trim().min(1).max(300).optional(),
  body: groundedFollowUpTextSchema,
});

const roleQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1_000),
  jobEvidence: jobEvidenceSchema,
});

const starPreparationSchema = z.object({
  prompt: z.string().trim().min(1).max(1_000),
  suggestedEvidence: groundedFollowUpTextSchema,
  userInputRequired: z.literal(true),
});

export const followUpMaterialsContentSchema = z.object({
  delivery: z.literal("draft_only"),
  sent: z.literal(false),
  recruiterFollowUpEmail: messageDraftSchema,
  hiringManagerLinkedInMessage: messageDraftSchema,
  thankYouMessageAfterInterview: messageDraftSchema,
  interviewPreparationBrief: z.object({
    overview: groundedFollowUpTextSchema,
    verifiedStrengths: z.array(groundedFollowUpTextSchema).min(2).max(6),
    roleSpecificQuestions: z.array(roleQuestionSchema).min(1).max(10),
    companyResearchChecklist: z.array(z.string().trim().min(1).max(500)).min(3).max(10),
  }),
  starPreparation: z.array(starPreparationSchema).min(1).max(6),
});

export type GroundedFollowUpText = z.infer<typeof groundedFollowUpTextSchema>;
export type FollowUpMaterialsContent = z.infer<typeof followUpMaterialsContentSchema>;

type TrackingEvidence = {
  contactPerson?: string | null;
  interviewStages?: Array<{ stage: string; status: string }>;
};

type ProvenanceValue<T> = {
  value: T;
  source: "explicit" | "inferred" | "unknown";
  excerpts: string[];
  confidence: number;
};

const wordTokens = (value: string) => new Set(
  value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((word) => word.length >= 3),
);

function relevanceScore(candidate: string, jobTokens: Set<string>) {
  return [...wordTokens(candidate)].reduce(
    (score, word) => score + (jobTokens.has(word) ? 1 : 0),
    0,
  );
}

function usableClaimIds(profile: CandidateProfile, claimIds: string[]) {
  const usable = new Set(
    profile.claims
      .filter((claim) => claim.status === "verified" || claim.status === "user-entered")
      .map((claim) => claim.id),
  );
  return claimIds.filter((claimId) => usable.has(claimId));
}

function originalDescriptionEvidence(job: StructuredJob) {
  const excerpt = job.originalDescription.trim().slice(0, 1_500);
  return jobEvidenceSchema.parse({
    field: "originalDescription",
    value: excerpt,
    source: "explicit",
    excerpts: [excerpt],
    confidence: 1,
  });
}

function provenanceEvidence(
  field: z.infer<typeof jobEvidenceFieldSchema>,
  value: string,
  provenance: ProvenanceValue<unknown>,
) {
  return jobEvidenceSchema.parse({
    field,
    value,
    source: provenance.source,
    excerpts: provenance.excerpts,
    confidence: provenance.confidence,
  });
}

function firstJobEvidence(job: StructuredJob) {
  const candidates: Array<{
    field: z.infer<typeof jobEvidenceFieldSchema>;
    values: string[];
    provenance: ProvenanceValue<unknown>;
  }> = [
    { field: "requiredSkills", values: job.requiredSkills.value, provenance: job.requiredSkills },
    { field: "responsibilities", values: job.responsibilities.value, provenance: job.responsibilities },
    { field: "requiredExperience", values: job.requiredExperience.value, provenance: job.requiredExperience },
    { field: "technologyStack", values: job.technologyStack.value, provenance: job.technologyStack },
    { field: "selectionCriteria", values: job.selectionCriteria.value, provenance: job.selectionCriteria },
  ];
  const selected = candidates.find((candidate) => candidate.values.length > 0);
  return selected
    ? provenanceEvidence(selected.field, selected.values[0], selected.provenance)
    : originalDescriptionEvidence(job);
}

function jobQuestionEvidence(job: StructuredJob) {
  const candidates: Array<{
    field: z.infer<typeof jobEvidenceFieldSchema>;
    values: string[];
    provenance: ProvenanceValue<unknown>;
  }> = [
    { field: "requiredSkills", values: job.requiredSkills.value, provenance: job.requiredSkills },
    { field: "responsibilities", values: job.responsibilities.value, provenance: job.responsibilities },
    { field: "requiredExperience", values: job.requiredExperience.value, provenance: job.requiredExperience },
    { field: "selectionCriteria", values: job.selectionCriteria.value, provenance: job.selectionCriteria },
    { field: "technologyStack", values: job.technologyStack.value, provenance: job.technologyStack },
  ];
  const evidence = candidates.flatMap((candidate) =>
    candidate.values.slice(0, 3).map((value) =>
      provenanceEvidence(candidate.field, value, candidate.provenance),
    ),
  );
  return evidence.length ? evidence.slice(0, 8) : [originalDescriptionEvidence(job)];
}

function groundedText(input: {
  text: string;
  claimIds: string[];
  jobEvidence: ReturnType<typeof originalDescriptionEvidence>[];
  applicationEvidenceFields: Array<z.infer<typeof applicationEvidenceFieldSchema>>;
  factsNeedingConfirmation?: string[];
}) {
  return groundedFollowUpTextSchema.parse({
    text: input.text,
    evidenceClaimIds: input.claimIds,
    jobEvidence: input.jobEvidence,
    applicationEvidenceFields: input.applicationEvidenceFields,
    requiresUserReview: true,
    factsNeedingConfirmation: input.factsNeedingConfirmation ?? [],
  });
}

/** Pure deterministic generator. It creates review-only drafts and never sends them. */
export function generateGroundedFollowUpMaterials(input: {
  profile: CandidateProfile;
  job: StructuredJob;
  application: Application;
  tracking?: TrackingEvidence;
}): FollowUpMaterialsContent {
  const { profile, job, application, tracking } = input;
  const terms = wordTokens(job.originalDescription);
  const projects = [...profile.projects].sort((left, right) =>
    relevanceScore(`${right.name} ${right.highlights.join(" ")} ${right.technologies.join(" ")}`, terms)
      - relevanceScore(`${left.name} ${left.highlights.join(" ")} ${left.technologies.join(" ")}`, terms),
  );
  const employment = [...profile.employment].sort((left, right) =>
    relevanceScore(`${right.role} ${right.highlights.join(" ")}`, terms)
      - relevanceScore(`${left.role} ${left.highlights.join(" ")}`, terms),
  );
  const project = projects[0];
  const role = employment[0];
  const education = profile.education[0];
  if (!project || !role || !education) {
    throw new Error("Follow-up materials require confirmed project, employment and education evidence.");
  }

  const projectClaimIds = usableClaimIds(profile, project.claimIds);
  const roleClaimIds = usableClaimIds(profile, role.claimIds);
  const educationClaimIds = usableClaimIds(profile, education.claimIds);
  const preferredNameClaimIds = usableClaimIds(profile, ["preferred-name"]);
  const allClaimIds = [...new Set([
    ...preferredNameClaimIds,
    ...projectClaimIds,
    ...roleClaimIds,
    ...educationClaimIds,
  ])];
  if (!projectClaimIds.length || !roleClaimIds.length || !educationClaimIds.length) {
    throw new Error("Follow-up materials may only use verified or user-entered candidate evidence.");
  }

  const roleEvidence = firstJobEvidence(job);
  const originalEvidence = originalDescriptionEvidence(job);
  const contactName = tracking?.contactPerson?.trim() || "Hiring team";
  const applicationFields: Array<z.infer<typeof applicationEvidenceFieldSchema>> = [
    "company",
    "role",
    "status",
    "dateApplied",
  ];
  if (tracking?.contactPerson) applicationFields.push("contactPerson");

  const recruiterBody = groundedText({
    text: [
      `Hello ${contactName},`,
      "",
      `I am following up on my application for the ${application.role} role at ${application.company}.`,
      `${project.highlights[0]} My experience also includes: ${role.highlights[0]}.`,
      "[USER INPUT REQUIRED: add one genuine, role-specific reason you remain interested and confirm the preferred follow-up timing.]",
      "",
      `Kind regards,\n${profile.preferredName}`,
    ].join("\n"),
    claimIds: allClaimIds,
    jobEvidence: [roleEvidence, originalEvidence],
    applicationEvidenceFields: applicationFields,
    factsNeedingConfirmation: [
      "Confirm the recipient name and preferred contact channel.",
      "Add a genuine reason for continued interest before sending.",
      "Confirm that the follow-up timing complies with the employer's instructions.",
    ],
  });

  const linkedInBody = groundedText({
    text: `Hello ${contactName}, I recently applied for the ${application.role} role at ${application.company}. ${project.highlights[0]} My background also includes ${role.highlights[0].replace(/^./, (letter) => letter.toLowerCase())}. [USER INPUT REQUIRED: add a genuine reason for contacting this person.]`,
    claimIds: allClaimIds,
    jobEvidence: [roleEvidence, originalEvidence],
    applicationEvidenceFields: applicationFields,
    factsNeedingConfirmation: [
      "Confirm this person is involved in hiring for the role.",
      "Add a genuine reason for the connection request or message.",
    ],
  });

  const completedInterview = tracking?.interviewStages?.some((stage) => stage.status === "completed");
  const thankYouBody = groundedText({
    text: [
      `Hello ${contactName},`,
      "",
      `Thank you for discussing the ${application.role} opportunity at ${application.company}.`,
      "[USER INPUT REQUIRED: add one specific topic discussed, the interviewer's name, and why it mattered.]",
      `A relevant part of my background is: ${project.highlights[0]}`,
      "",
      `Kind regards,\n${profile.preferredName}`,
    ].join("\n"),
    claimIds: [...new Set([...preferredNameClaimIds, ...projectClaimIds])],
    jobEvidence: [roleEvidence, originalEvidence],
    applicationEvidenceFields: completedInterview
      ? [...applicationFields, "interviewStages"]
      : applicationFields,
    factsNeedingConfirmation: completedInterview
      ? ["Add the interviewer name and an exact discussion point before sending."]
      : ["No completed interview is recorded. Do not use this draft until an interview has occurred."],
  });

  const verifiedStrengths = [
    groundedText({
      text: `${project.name}: ${project.highlights[0]}`,
      claimIds: projectClaimIds,
      jobEvidence: [roleEvidence],
      applicationEvidenceFields: ["company", "role"],
    }),
    groundedText({
      text: `${role.role} at ${role.employer}: ${role.highlights[0]}`,
      claimIds: roleClaimIds,
      jobEvidence: [roleEvidence],
      applicationEvidenceFields: ["company", "role"],
    }),
    groundedText({
      text: `${education.qualification}, ${education.institution}.`,
      claimIds: educationClaimIds,
      jobEvidence: [roleEvidence],
      applicationEvidenceFields: ["company", "role"],
    }),
  ];

  const questions = jobQuestionEvidence(job).map((evidence) => ({
    question: `How would you apply your experience to ${evidence.value}?`,
    jobEvidence: evidence,
  }));
  const starPreparation = questions.slice(0, 4).map((question, index) => {
    const useProject = index % 2 === 0;
    return {
      prompt: question.question,
      suggestedEvidence: groundedText({
        text: useProject
          ? `${project.name}: ${project.highlights[0]}`
          : `${role.role} at ${role.employer}: ${role.highlights[0]}`,
        claimIds: useProject ? projectClaimIds : roleClaimIds,
        jobEvidence: [question.jobEvidence],
        applicationEvidenceFields: ["company", "role"],
        factsNeedingConfirmation: [
          "Add a specific situation, your individual actions, and the factual result.",
          "Do not add a metric unless it has a confirmed metric claim.",
        ],
      }),
      userInputRequired: true as const,
    };
  });

  return followUpMaterialsContentSchema.parse({
    delivery: "draft_only",
    sent: false,
    recruiterFollowUpEmail: {
      subject: `Follow-up: ${application.role} application`,
      body: recruiterBody,
    },
    hiringManagerLinkedInMessage: { body: linkedInBody },
    thankYouMessageAfterInterview: {
      subject: `Thank you - ${application.role} interview`,
      body: thankYouBody,
    },
    interviewPreparationBrief: {
      overview: groundedText({
        text: `Prepare for the ${application.role} process at ${application.company} by positioning ${project.name}, ${role.role} experience, and ${education.qualification} against the employer's stated requirements.`,
        claimIds: allClaimIds,
        jobEvidence: [roleEvidence, originalEvidence],
        applicationEvidenceFields: ["company", "role", "status"],
      }),
      verifiedStrengths,
      roleSpecificQuestions: questions,
      companyResearchChecklist: [
        "Review the employer's official website and current public product or service information.",
        "Identify the team, reporting line and current priorities without inferring facts not stated publicly.",
        "Check the original job description for closing dates, contact instructions and interview format.",
        "Prepare questions about success measures, onboarding, team practices and the role's first priorities.",
      ],
    },
    starPreparation,
  });
}

export function allGroundedFollowUpStatements(content: FollowUpMaterialsContent) {
  return [
    content.recruiterFollowUpEmail.body,
    content.hiringManagerLinkedInMessage.body,
    content.thankYouMessageAfterInterview.body,
    content.interviewPreparationBrief.overview,
    ...content.interviewPreparationBrief.verifiedStrengths,
    ...content.starPreparation.map((item) => item.suggestedEvidence),
  ].map((statement) => ({
    text: statement.text,
    evidenceClaimIds: statement.evidenceClaimIds,
  }));
}
