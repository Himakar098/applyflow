import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

for (const envName of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!process.env[envName]) {
    console.error(
      `Missing ${envName}. Start the Firebase emulators and set emulator env vars before seeding.`,
    );
    process.exit(1);
  }
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "applyflow-local";

const seedEmail = process.env.APPLYFLOW_SEED_EMAIL || "demo@applyflow.local";
const seedPassword = process.env.APPLYFLOW_SEED_PASSWORD || "applyflow-demo";

const app =
  getApps()[0] ||
  initializeApp({
    projectId,
  });

const auth = getAuth(app);
const db = getFirestore(app);
const now = new Date().toISOString();
const dateKey = now.split("T")[0];

let userRecord;
try {
  userRecord = await auth.getUserByEmail(seedEmail);
} catch {
  userRecord = await auth.createUser({
    email: seedEmail,
    password: seedPassword,
    displayName: "ApplyFlow Demo User",
  });
}

const uid = userRecord.uid;

await db.doc(`users/${uid}`).set(
  {
    seededBy: "scripts/seed-firebase-emulators.mjs",
    seedUpdatedAt: now,
  },
  { merge: true },
);

await db.doc(`users/${uid}/profile/current`).set({
  fullName: "ApplyFlow Demo User",
  email: seedEmail,
  location: "Perth, WA",
  targetRoles: ["Business Analyst", "Operations Analyst", "Project Coordinator"],
  preferredLocations: ["Perth", "Western Australia", "Australia"],
  preferredLocationScope: "city",
  preferredLocationCountry: "Australia",
  preferredLocationState: "Western Australia",
  preferredLocationCity: "Perth",
  preferredWorkModes: ["hybrid", "remote"],
  preferredSeniority: ["early", "mid"],
  yearsExperienceApprox: 4,
  skills: {
    languages: ["SQL", "Python"],
    tools: ["Excel", "Power BI", "Jira"],
    cloud: ["Azure"],
    databases: ["PostgreSQL"],
  },
  workExperience: [
    {
      company: "Example Logistics",
      role: "Business Analyst",
      startDate: "2022-01-01",
      bullets: [
        "Built reporting workflows for operations teams.",
        "Mapped business processes and improved handoff quality.",
      ],
      tools: ["Excel", "Power BI", "Jira"],
    },
  ],
  projects: [
    {
      title: "Warehouse KPI Dashboard",
      stack: ["Power BI", "SQL"],
      impact: "Reduced weekly reporting effort.",
      bullets: ["Created operational dashboards for leadership reporting."],
    },
  ],
  education: [
    {
      institution: "Curtin University",
      degree: "Bachelor of Commerce",
      field: "Business Information Systems",
    },
  ],
  certifications: [
    {
      name: "Microsoft Power BI Data Analyst",
      year: "2025",
    },
  ],
  updatedAt: now,
});

await db.doc(`users/${uid}/settings/auto-apply`).set({
  enabled: true,
  minScore: 75,
  maxApplicationsPerDay: 5,
  filters: {
    locations: ["Perth"],
    workModes: ["hybrid", "remote"],
    excludeCompanies: [],
    excludeKeywords: ["unpaid", "intern"],
    industries: ["Mining", "Logistics", "Technology"],
  },
  attachResume: true,
  attachOtherDocs: false,
  autoSubmit: false,
  notifyOnTasksPending: true,
  weeklyReviewEmail: false,
});

await db.doc(`users/${uid}/analytics/auto-apply-${dateKey}`).set({
  events: {
    auto_apply_submitted: [
      { company: "BHP", jobTitle: "Operations Analyst", createdAt: now },
    ],
    manual_task_created: [
      { company: "Rio Tinto", jobTitle: "Business Analyst", createdAt: now },
    ],
  },
  updatedAt: now,
});

await db.doc(`users/${uid}/manual-tasks/demo-captcha`).set({
  id: "demo-captcha",
  jobId: "demo-job-1",
  queueId: "queue-demo-1",
  jobTitle: "Business Analyst",
  company: "Example Mining Co",
  taskType: "captcha",
  description: "Employer site requires CAPTCHA verification.",
  instructions:
    "Open the employer site, clear the CAPTCHA on the same tab, then resume assisted autofill.",
  applicationUrl: "https://example.com/careers/business-analyst",
  createdAt: now,
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  completed: false,
});

await db.doc(`users/${uid}/jobs/demo-job-1`).set({
  company: "Example Mining Co",
  title: "Business Analyst",
  location: "Perth, WA",
  source: "Company site",
  status: "saved",
  jobDescription: "Analyze operations data and improve reporting.",
  jobUrl: "https://example.com/jobs/demo-job-1",
  applicationUrl: "https://example.com/careers/business-analyst",
  notes: "Seeded demo job for local emulator testing.",
  createdAt: now,
  updatedAt: now,
});

console.log("Firebase emulators seeded successfully.");
console.log(`Demo login: ${seedEmail}`);
console.log(`Demo password: ${seedPassword}`);
console.log(`Seeded user uid: ${uid}`);
