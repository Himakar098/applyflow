import path from "node:path";

import { exportGroundedApplicationDocuments } from "@/lib/documents/job-agent-export";

async function main() {
  const output = await exportGroundedApplicationDocuments({
  applicationId: "visual-check",
  candidateName: "Candidate Name",
  company: "Acme Analytics",
  role: "Junior Data Analyst",
  location: "Perth, Western Australia",
  workRights: "Temporary Graduate visa (subclass 485) - full Australian work rights, subject to current visa conditions",
  summary: "Early-career analyst and AI engineer with grounded project and operational experience.",
  skills: ["Python", "SQL", "Power BI", "Data analysis", "Stakeholder communication"],
  sections: [
    {
      heading: "Selected project",
      title: "Practical analytics automation",
      subtitle: "Python | SQL | Power BI",
      bullets: [
        "Built a reproducible reporting workflow from confirmed project evidence.",
        "Communicated findings in concise dashboards for operational review.",
      ],
    },
    {
      heading: "Experience",
      title: "Operational team member",
      subtitle: "Perth, Western Australia",
      bullets: ["Worked reliably with team processes and customer-facing priorities."],
    },
  ],
  education: [{ degree: "Master of Information Technology", institution: "Australian institution" }],
  coverLetter: [
    "Dear Hiring Team,",
    "I am applying for the Junior Data Analyst role at Acme Analytics. My confirmed background includes practical Python, SQL, reporting, and stakeholder communication experience.",
    "I hold full Australian work rights under a Temporary Graduate visa (subclass 485), subject to my current visa conditions.",
    "Kind regards,\nCandidate Name",
  ].join("\n\n"),
  }, {
    baseDirectory: path.join(process.cwd(), "storage", "generated", "applications"),
  });

  process.stdout.write(`${JSON.stringify(output)}\n`);
}

void main();
