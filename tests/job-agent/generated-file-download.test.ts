import path from "node:path";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { readGeneratedApplicationExport } from "@/lib/job-agent/server/generated-file-download";

describe("generated document downloads", () => {
  it("reads only the requested application's regular export file", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "applyflow-download-"));
    try {
      const directory = path.join(
        workspaceRoot,
        "storage",
        "generated",
        "applications",
        "application-1",
      );
      await mkdir(directory, { recursive: true });
      const target = path.join(directory, "Candidate_Resume.pdf");
      await writeFile(target, Buffer.from("safe-pdf"));
      const result = await readGeneratedApplicationExport({
        workspaceRoot,
        applicationId: "application-1",
        storedPath: path.relative(workspaceRoot, target),
        kind: "resumePdf",
      });
      expect(result.bytes.toString()).toBe("safe-pdf");
      expect(result.contentType).toBe("application/pdf");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects traversal, cross-application paths and symbolic links", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "applyflow-download-"));
    try {
      const root = path.join(workspaceRoot, "storage", "generated", "applications");
      const ownDirectory = path.join(root, "application-1");
      const otherDirectory = path.join(root, "application-2");
      await mkdir(ownDirectory, { recursive: true });
      await mkdir(otherDirectory, { recursive: true });
      const outside = path.join(workspaceRoot, "outside.pdf");
      await writeFile(outside, "outside");
      const linked = path.join(ownDirectory, "linked.pdf");
      await symlink(outside, linked);

      await expect(readGeneratedApplicationExport({
        workspaceRoot,
        applicationId: "application-1",
        storedPath: "../outside.pdf",
        kind: "resumePdf",
      })).rejects.toThrow(/escaped|relative/i);
      await expect(readGeneratedApplicationExport({
        workspaceRoot,
        applicationId: "application-1",
        storedPath: path.relative(workspaceRoot, path.join(otherDirectory, "other.pdf")),
        kind: "resumePdf",
      })).rejects.toThrow(/escaped/i);
      await expect(readGeneratedApplicationExport({
        workspaceRoot,
        applicationId: "application-1",
        storedPath: path.relative(workspaceRoot, linked),
        kind: "resumePdf",
      })).rejects.toThrow(/symbolic link/i);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});

