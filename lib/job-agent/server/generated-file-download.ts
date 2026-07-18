import path from "node:path";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";

export const applicationExportKinds = [
  "resumeDocx",
  "resumePdf",
  "coverLetterDocx",
  "coverLetterPdf",
] as const;

export type ApplicationExportKind = (typeof applicationExportKinds)[number];

const exportMetadata: Record<ApplicationExportKind, { extension: string; contentType: string }> = {
  resumeDocx: {
    extension: ".docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  resumePdf: { extension: ".pdf", contentType: "application/pdf" },
  coverLetterDocx: {
    extension: ".docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  coverLetterPdf: { extension: ".pdf", contentType: "application/pdf" },
};

function inside(parent: string, candidate: string) {
  return candidate.startsWith(`${parent}${path.sep}`);
}

async function assertNoSymlinkComponents(base: string, candidate: string) {
  const relative = path.relative(base, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Generated export path is outside the workspace");
  }
  let current = base;
  let finalInfo: Awaited<ReturnType<typeof lstat>> | null = null;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    finalInfo = await lstat(current);
    if (finalInfo.isSymbolicLink()) {
      throw new Error("Symbolic links are not permitted for generated exports");
    }
  }
  return finalInfo;
}

export async function readGeneratedApplicationExport(input: {
  workspaceRoot: string;
  applicationId: string;
  storedPath: string;
  kind: ApplicationExportKind;
  maximumBytes?: number;
}) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(input.applicationId)) {
    throw new Error("Invalid application id");
  }
  if (path.isAbsolute(input.storedPath)) {
    throw new Error("Stored export path must be workspace-relative");
  }
  const root = path.resolve(input.workspaceRoot, "storage", "generated", "applications");
  const applicationRoot = path.resolve(root, input.applicationId);
  const candidate = path.resolve(input.workspaceRoot, input.storedPath);
  if (!inside(root, applicationRoot) || !inside(applicationRoot, candidate)) {
    throw new Error("Stored export path escaped the application directory");
  }
  const metadata = exportMetadata[input.kind];
  if (path.extname(candidate).toLowerCase() !== metadata.extension) {
    throw new Error("Stored export extension does not match the requested kind");
  }

  const candidateInfo = await assertNoSymlinkComponents(
    path.resolve(input.workspaceRoot),
    candidate,
  );
  if (!candidateInfo) throw new Error("Generated export is unavailable");
  if (!candidateInfo.isFile()) throw new Error("Generated export is not a regular file");

  const [realRoot, realApplicationRoot, realCandidate] = await Promise.all([
    realpath(root),
    realpath(applicationRoot),
    realpath(candidate),
  ]);
  if (!inside(realRoot, realApplicationRoot) || !inside(realApplicationRoot, realCandidate)) {
    throw new Error("Generated export resolved outside its application directory");
  }

  const maximumBytes = input.maximumBytes ?? 20 * 1024 * 1024;
  const handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > maximumBytes) {
      throw new Error("Generated export is invalid or exceeds the download limit");
    }
    const afterOpenPath = await realpath(candidate);
    if (afterOpenPath !== realCandidate) {
      throw new Error("Generated export path changed during validation");
    }
    return {
      bytes: await handle.readFile(),
      fileName: path.basename(candidate),
      contentType: metadata.contentType,
    };
  } finally {
    await handle.close();
  }
}
