import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import {
  applicationSchema,
  assessJobEligibility,
  extractJobDescription,
  himakarCandidateProfile,
  scoreJobFit,
} from "../lib/job-agent/index";

for (const envName of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!process.env[envName]) {
    console.error(`Missing ${envName}. Start the Firebase emulators before seeding.`);
    process.exit(1);
  }
}

const projectId =
  process.env.FIREBASE_PROJECT_ID
  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  || "applyflow-local";
const seedEmail = process.env.APPLYFLOW_SEED_EMAIL || "demo@applyflow.local";
const seedPassword = process.env.APPLYFLOW_SEED_PASSWORD || "applyflow-demo";
const app = getApps()[0] || initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const now = new Date().toISOString();

let user;
try {
  user = await auth.getUserByEmail(seedEmail);
} catch {
  user = await auth.createUser({
    email: seedEmail,
    password: seedPassword,
    displayName: "ApplyFlow Demo User",
  });
}

const uid = user.uid;
await db.doc(`users/${uid}/jobAgentProfile/current`).set({
  id: "current",
  profile: { ...himakarCandidateProfile, updatedAt: now },
  encryptedPrivateContact: null,
  createdAt: now,
  updatedAt: now,
});

const fixtures = [
  {
    id: "seed-ai-engineer",
    description: `
Company: Harbour AI Labs
Title: Applied AI Engineer
Location: Perth, Western Australia
Work arrangement: Hybrid
Employment type: Full-time
Application URL: http://127.0.0.1:3000/job-agent-fixtures/generic.html

About the role
Build applied generative AI and natural language processing workflows using Python, TypeScript, React, Node.js, REST APIs and WebSockets. Partner with customers and operational teams to prototype and deliver useful AI products.

Requirements
- Practical Python and TypeScript experience
- Experience building applied AI or machine learning products
- Strong stakeholder communication
- Full Australian working rights; temporary visa holders with unrestricted work rights are welcome
`,
  },
  {
    id: "seed-data-analyst",
    description: `
Company: Western Insights
Title: Data Analyst
Location: Perth, Western Australia
Work arrangement: Hybrid
Employment type: Full-time
Application URL: http://127.0.0.1:3000/job-agent-fixtures/greenhouse.html

Responsibilities
- Automate operational reporting and create clear dashboards
- Analyse data with SQL and Python and communicate findings to stakeholders

Required skills
- SQL
- Python
- Data analysis
- Dashboard development

Candidates must have valid Australian working rights. Temporary Graduate visa holders may apply.
`,
  },
  {
    id: "seed-senior-engineer",
    description: `
Company: Example Enterprise
Title: Senior Machine Learning Engineer
Location: Sydney, New South Wales
Work arrangement: Onsite
Employment type: Full-time
Application URL: http://127.0.0.1:3000/job-agent-fixtures/lever.html

Requirements
- 8+ years of production machine learning engineering experience
- Expert Kubernetes, AWS and distributed systems knowledge
- Experience leading a large engineering team
- Applicants with current Australian working rights may apply
`,
  },
  {
    id: "seed-citizenship-role",
    description: `
Company: Secure Defence Systems
Title: Defence Data Scientist
Location: Canberra, Australian Capital Territory
Work arrangement: Onsite
Employment type: Full-time
Application URL: http://127.0.0.1:3000/job-agent-fixtures/workday-like.html

Essential requirements
- Australian citizenship is mandatory
- Candidates must hold or be eligible to obtain an NV1 security clearance
- Python and machine learning experience
`,
  },
] as const;

for (const fixture of fixtures) {
  const structured = extractJobDescription({
    id: fixture.id,
    description: fixture.description.trim(),
    sourceUrl: `http://127.0.0.1:3000/job-agent-fixtures/${fixture.id}.html`,
    applicationUrl: fixture.description.match(/Application URL:\s*(\S+)/)?.[1],
    extractedAt: now,
  });
  const eligibility = assessJobEligibility(structured, himakarCandidateProfile, {
    assessedAt: now,
  });
  const fit = scoreJobFit(structured, himakarCandidateProfile, eligibility, {
    assessedAt: now,
  });
  await Promise.all([
    db.doc(`users/${uid}/jobAgentJobs/${fixture.id}`).set({
      ...structured,
      eligibility: eligibility.decision,
      fitScore: fit.score,
      createdAt: now,
      updatedAt: now,
    }),
    db.doc(`users/${uid}/jobAssessments/${fixture.id}`).set({
      id: fixture.id,
      jobId: fixture.id,
      eligibility,
      fit,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

const eligibleJob = fixtures[0];
const eligibleStructured = extractJobDescription({
  id: eligibleJob.id,
  description: eligibleJob.description.trim(),
  applicationUrl: "http://127.0.0.1:3000/job-agent-fixtures/generic.html",
  extractedAt: now,
});
const eligibleAssessment = assessJobEligibility(
  eligibleStructured,
  himakarCandidateProfile,
  { assessedAt: now },
);
const eligibleFit = scoreJobFit(
  eligibleStructured,
  himakarCandidateProfile,
  eligibleAssessment,
  { assessedAt: now },
);
const applicationId = "seed-application-in-progress";
const application = applicationSchema.parse({
  id: applicationId,
  jobId: eligibleJob.id,
  candidateProfileId: himakarCandidateProfile.id,
  company: eligibleStructured.company.value ?? "Harbour AI Labs",
  role: eligibleStructured.title.value ?? "Applied AI Engineer",
  source: "local seed fixture",
  jobUrl: "http://127.0.0.1:3000/job-agent-fixtures/generic.html",
  applicationUrl: "http://127.0.0.1:3000/job-agent-fixtures/generic.html",
  fitScore: eligibleFit.score,
  eligibility: eligibleAssessment.decision,
  status: "READY_FOR_REVIEW",
  submissionMode: "review_before_submit",
  autofillPlanHash: null,
  dateDiscovered: now,
  dateApplied: null,
  closingDate: null,
  createdAt: now,
  updatedAt: now,
});

await Promise.all([
  db.doc(`users/${uid}/applications/${applicationId}`).set({
    ...application,
    autofillPlan: null,
    bridgeAutofillPlan: null,
  }),
  db.doc(`users/${uid}/browserSessions/${applicationId}`).set({
    id: applicationId,
    applicationId,
    status: "REQUESTED",
    currentPage: application.applicationUrl,
    message: "Seeded mock application is waiting for visible browser inspection.",
    createdAt: now,
    updatedAt: now,
  }),
  db.doc(`users/${uid}/auditEvents/seed-job-captured`).set({
    id: "seed-job-captured",
    applicationId,
    type: "job_captured",
    actorId: uid,
    occurredAt: now,
    metadata: { jobId: eligibleJob.id, summary: "Seeded mock application" },
  }),
]);

console.log("Job Agent emulator data seeded successfully.");
console.log(`Seeded ${fixtures.length} assessed jobs and one supervised application for ${seedEmail}.`);
