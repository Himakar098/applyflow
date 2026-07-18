import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { chmod, lstat, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";

export type GroundedResumeSection = {
  heading: string;
  title: string;
  subtitle?: string;
  bullets: string[];
};

export type GroundedApplicationPack = {
  applicationId: string;
  candidateName: string;
  company: string;
  role: string;
  location?: string;
  workRights?: string;
  summary: string;
  skills: string[];
  sections: GroundedResumeSection[];
  education: Array<{ degree: string; institution: string; period?: string }>;
  coverLetter: string;
};

export type ExportedApplicationDocuments = {
  directory: string;
  resumeDocx: string;
  resumePdf: string;
  coverLetterDocx: string;
  coverLetterPdf: string;
};

const DEFAULT_BASE = path.join(process.cwd(), "storage", "generated", "applications");

async function safePrivateWrite(target: string, data: Buffer) {
  const temporary = path.join(path.dirname(target), `.applyflow-${randomUUID()}.tmp`);
  await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
  try {
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}

function asciiText(value: string) {
  return value
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u00a0/g, " ")
    .trim();
}

function safeId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    throw new Error("Application id must contain only letters, numbers, underscores, or hyphens");
  }
  return value;
}

function safeFilePart(value: string) {
  const cleaned = asciiText(value)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || "Application";
}

function paragraph(
  text: string,
  options?: {
    bold?: boolean;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  },
) {
  const value = asciiText(text);
  if (options?.heading) {
    return new Paragraph({ text: value, heading: options.heading, spacing: { before: 180, after: 80 } });
  }
  return new Paragraph({
    children: [new TextRun({ text: value, bold: options?.bold, size: 21 })],
    spacing: { after: 80, line: 260 },
  });
}

function resumeDoc(pack: GroundedApplicationPack) {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: asciiText(pack.candidateName), bold: true, size: 34 })],
      spacing: { after: 80 },
    }),
    paragraph([pack.location, pack.workRights].filter(Boolean).join(" | ")),
    paragraph("Professional summary", { heading: HeadingLevel.HEADING_1 }),
    paragraph(pack.summary),
    paragraph("Core skills", { heading: HeadingLevel.HEADING_1 }),
    paragraph(pack.skills.map(asciiText).join(" | ")),
  ];

  for (const section of pack.sections.slice(0, 8)) {
    children.push(paragraph(section.heading, { heading: HeadingLevel.HEADING_1 }));
    children.push(paragraph(section.title, { bold: true }));
    if (section.subtitle) children.push(paragraph(section.subtitle));
    for (const bullet of section.bullets.slice(0, 5)) {
      children.push(
        new Paragraph({
          text: asciiText(bullet),
          bullet: { level: 0 },
          spacing: { after: 55, line: 245 },
        }),
      );
    }
  }

  if (pack.education.length) {
    children.push(paragraph("Education", { heading: HeadingLevel.HEADING_1 }));
    for (const item of pack.education.slice(0, 4)) {
      children.push(paragraph(`${item.degree} - ${item.institution}${item.period ? ` | ${item.period}` : ""}`));
    }
  }

  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 23, bold: true, color: "17324D" },
          paragraph: { spacing: { before: 180, after: 80 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });
}

function coverLetterDoc(pack: GroundedApplicationPack) {
  const paragraphs = asciiText(pack.coverLetter)
    .split("\n")
    .map((value) => value.trim()
      ? paragraph(value)
      : new Paragraph({ spacing: { after: 80 } }));
  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children: [
          paragraph(pack.candidateName, { bold: true }),
          paragraph(`${pack.role} - ${pack.company}`),
          new Paragraph({ spacing: { after: 180 } }),
          ...paragraphs,
        ],
      },
    ],
  });
}

async function renderPdf(
  target: string,
  title: string,
  blocks: Array<{ text: string; style?: "title" | "heading" | "body" | "bullet" }>,
) {
  const doc = new PDFDocument({ size: "A4", margins: { top: 45, right: 48, bottom: 45, left: 48 }, info: { Title: title } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (const block of blocks) {
    const text = asciiText(block.text);
    if (!text) continue;
    if (block.style === "title") {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#17324d").text(text, { paragraphGap: 6 });
    } else if (block.style === "heading") {
      doc.moveDown(0.35).font("Helvetica-Bold").fontSize(11).fillColor("#17324d").text(text, { paragraphGap: 3 });
    } else if (block.style === "bullet") {
      doc.font("Helvetica").fontSize(9.5).fillColor("#111827").text(`- ${text}`, { indent: 10, paragraphGap: 2.5, lineGap: 1 });
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#111827").text(text, { paragraphGap: 7, lineGap: 2 });
    }
  }

  doc.end();
  await safePrivateWrite(target, await completed);
}

export async function exportGroundedApplicationDocuments(
  input: GroundedApplicationPack,
  options?: { baseDirectory?: string },
): Promise<ExportedApplicationDocuments> {
  const pack: GroundedApplicationPack = {
    ...input,
    applicationId: safeId(input.applicationId),
    candidateName: asciiText(input.candidateName),
    company: asciiText(input.company),
    role: asciiText(input.role),
  };
  const baseDirectory = path.resolve(options?.baseDirectory ?? DEFAULT_BASE);
  const directory = path.resolve(baseDirectory, pack.applicationId);
  if (directory !== baseDirectory && !directory.startsWith(`${baseDirectory}${path.sep}`)) {
    throw new Error("Generated document path escaped its configured base directory");
  }
  await mkdir(baseDirectory, { recursive: true, mode: 0o700 });
  const baseStats = await lstat(baseDirectory);
  if (baseStats.isSymbolicLink() || !baseStats.isDirectory()) {
    throw new Error("Generated document base directory must be a real private directory");
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStats = await lstat(directory);
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    throw new Error("Generated application directory must not be a symbolic link");
  }
  const [realBaseDirectory, realDirectory] = await Promise.all([
    realpath(baseDirectory),
    realpath(directory),
  ]);
  if (
    realDirectory !== realBaseDirectory &&
    !realDirectory.startsWith(`${realBaseDirectory}${path.sep}`)
  ) {
    throw new Error("Generated document path escaped its real configured base directory");
  }
  await chmod(baseDirectory, 0o700);
  await chmod(directory, 0o700);

  const prefix = `${safeFilePart(pack.candidateName)}_${safeFilePart(pack.company)}_${safeFilePart(pack.role)}`;
  const paths = {
    directory,
    resumeDocx: path.join(directory, `${prefix}_Resume.docx`),
    resumePdf: path.join(directory, `${prefix}_Resume.pdf`),
    coverLetterDocx: path.join(directory, `${prefix}_Cover_Letter.docx`),
    coverLetterPdf: path.join(directory, `${prefix}_Cover_Letter.pdf`),
  };

  await Promise.all([
    Packer.toBuffer(resumeDoc(pack)).then((buffer) => safePrivateWrite(paths.resumeDocx, buffer)),
    Packer.toBuffer(coverLetterDoc(pack)).then((buffer) => safePrivateWrite(paths.coverLetterDocx, buffer)),
    renderPdf(paths.resumePdf, `${pack.candidateName} - ${pack.role} resume`, [
      { text: pack.candidateName, style: "title" },
      { text: [pack.location, pack.workRights].filter(Boolean).join(" | "), style: "body" },
      { text: "Professional summary", style: "heading" },
      { text: pack.summary, style: "body" },
      { text: "Core skills", style: "heading" },
      { text: pack.skills.join(" | "), style: "body" },
      ...pack.sections.slice(0, 8).flatMap((section) => [
        { text: section.heading, style: "heading" as const },
        { text: [section.title, section.subtitle].filter(Boolean).join(" | "), style: "body" as const },
        ...section.bullets.slice(0, 5).map((text) => ({ text, style: "bullet" as const })),
      ]),
      ...(pack.education.length
        ? [
            { text: "Education", style: "heading" as const },
            ...pack.education.slice(0, 4).map((item) => ({
              text: `${item.degree} - ${item.institution}${item.period ? ` | ${item.period}` : ""}`,
              style: "body" as const,
            })),
          ]
        : []),
    ]),
    renderPdf(paths.coverLetterPdf, `${pack.candidateName} - ${pack.role} cover letter`, [
      { text: pack.candidateName, style: "title" },
      { text: `${pack.role} - ${pack.company}`, style: "heading" },
      ...asciiText(pack.coverLetter)
        .split(/\n\s*\n/)
        .map((text) => ({ text, style: "body" as const })),
    ]),
  ]);

  return paths;
}
