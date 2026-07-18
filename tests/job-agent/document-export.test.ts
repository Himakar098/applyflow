import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import mammoth from "mammoth";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportGroundedApplicationDocuments,
  type GroundedApplicationPack,
} from "@/lib/documents/job-agent-export";

const temporaryDirectories: string[] = [];

const pack: GroundedApplicationPack = {
  applicationId: "visual-check",
  candidateName: "Himakar Gadham",
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
  coverLetter: "Dear Hiring Team,\n\nI am applying for the Junior Data Analyst role at Acme Analytics. My confirmed background includes practical Python, SQL, reporting, and stakeholder communication experience.\n\nI hold full Australian work rights under a Temporary Graduate visa (subclass 485), subject to my current visa conditions.\n\nKind regards,\nHimakar Gadham",
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("grounded document export", () => {
  it("creates ATS-readable DOCX/PDF files with private permissions", async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), "applyflow-documents-"));
    temporaryDirectories.push(baseDirectory);
    const exported = await exportGroundedApplicationDocuments(pack, { baseDirectory });

    expect((await stat(exported.directory)).mode & 0o777).toBe(0o700);
    for (const filePath of [
      exported.resumeDocx,
      exported.resumePdf,
      exported.coverLetterDocx,
      exported.coverLetterPdf,
    ]) {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
      expect((await stat(filePath)).size).toBeGreaterThan(500);
    }

    const resumeText = (await mammoth.extractRawText({ buffer: await readFile(exported.resumeDocx) })).value;
    const coverLetterText = (await mammoth.extractRawText({ buffer: await readFile(exported.coverLetterDocx) })).value;
    expect(resumeText).toContain("Himakar Gadham");
    expect(resumeText).toContain("Professional summary");
    expect(resumeText).toContain("Python");
    expect(coverLetterText).toContain("Temporary Graduate visa (subclass 485)");
    expect((await readFile(exported.resumePdf)).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects application identifiers that could escape the export root", async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), "applyflow-documents-"));
    temporaryDirectories.push(baseDirectory);
    await expect(exportGroundedApplicationDocuments(
      { ...pack, applicationId: "../outside" },
      { baseDirectory },
    )).rejects.toThrow("Application id");
  });

  it("does not follow an application-directory symbolic link", async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), "applyflow-documents-"));
    const outsideDirectory = await mkdtemp(path.join(tmpdir(), "applyflow-documents-outside-"));
    temporaryDirectories.push(baseDirectory, outsideDirectory);
    await symlink(outsideDirectory, path.join(baseDirectory, pack.applicationId));
    await expect(exportGroundedApplicationDocuments(pack, { baseDirectory })).rejects.toThrow();
    expect((await stat(outsideDirectory)).isDirectory()).toBe(true);
  });
});
