import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";

import { HttpError } from "@/lib/auth/verify-id-token";
import { adminDb } from "@/lib/firebase/admin";
import {
  exportGroundedApplicationDocuments,
  type GroundedApplicationPack,
} from "@/lib/documents/job-agent-export";
import { himakarCandidateProfile, validateGroundedStatements } from "@/lib/job-agent";
import {
  generateApplicationContent,
} from "@/lib/job-agent/server/ai-provider";
import {
  allGroundedStatements,
  groundedApplicationContentSchema,
  isCanonicalApplicationContentSelection,
  type GroundedApplicationContent,
} from "@/lib/job-agent/server/generated-documents";
import {
  applicationExportKinds,
  readGeneratedApplicationExport,
  type ApplicationExportKind,
} from "@/lib/job-agent/server/generated-file-download";
import {
  getStoredApplication,
  type StoredApplicationDocument,
  updateApplicationStatus,
} from "@/lib/job-agent/server/application-service";
import { recordAuditEvent } from "@/lib/job-agent/server/audit-service";
import { getStoredAssessment, getStoredJob } from "@/lib/job-agent/server/job-service";
import { getCandidateProfile } from "@/lib/job-agent/server/profile-service";
import {
  JOB_AGENT_COLLECTIONS,
  getRecord,
  listRecords,
  userCollection,
  userDocument,
} from "@/lib/job-agent/server/store";

function publicDocumentView(document: StoredApplicationDocument) {
  const storedExports = document.exports;
  const publicDocument = { ...document };
  delete publicDocument.exports;
  delete publicDocument.exportHashes;
  delete publicDocument.profileRevision;
  const availableKinds = applicationExportKinds.filter((kind) => Boolean(storedExports?.[kind]));
  return {
    ...publicDocument,
    // Preserve the existing client's truthy availability checks without
    // revealing server storage paths or file-integrity hashes.
    exports: availableKinds.length
      ? Object.fromEntries(availableKinds.map((kind) => [kind, kind]))
      : null,
    availableKinds,
    fileName: storedExports?.resumePdf
      ? path.basename(storedExports.resumePdf)
      : undefined,
  };
}

export async function listApplicationDocuments(uid: string, applicationId: string) {
  await getStoredApplication(uid, applicationId);
  const documents = await listRecords<StoredApplicationDocument>(
    userCollection(uid, JOB_AGENT_COLLECTIONS.documents)
      .where("applicationId", "==", applicationId)
      .orderBy("createdAt", "desc")
      .limit(50),
  );
  return documents.map(publicDocumentView);
}

export async function generateApplicationDocuments(
  uid: string,
  applicationId: string,
  options: { regenerate?: boolean } = {},
) {
  const existing = await listApplicationDocuments(uid, applicationId);
  if (existing.length && !options.regenerate) {
    const { application } = await getStoredApplication(uid, applicationId);
    if (application.status === "DRAFT") {
      await updateApplicationStatus(uid, applicationId, { status: "READY_FOR_REVIEW" });
    }
    return existing[0];
  }

  const [{ application }, profile] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
  ]);
  if (application.eligibility === "ineligible") {
    throw new HttpError(409, "Documents cannot be generated for an ineligible application");
  }
  const [jobRecord, assessmentRecord] = await Promise.all([
    getStoredJob(uid, application.jobId),
    getStoredAssessment(uid, application.jobId),
  ]);
  if (!assessmentRecord) throw new HttpError(409, "Assess the job before generating documents");

  const generated = await generateApplicationContent({
    profile,
    job: jobRecord,
    fit: assessmentRecord.fit,
  });
  const truthfulness = validateGroundedStatements(
    allGroundedStatements(generated.content),
    profile,
  );
  if (!truthfulness.valid) {
    throw new HttpError(422, "Generated documents failed evidence-grounding checks");
  }

  const now = new Date().toISOString();
  const id = `document-${crypto.randomUUID()}`;
  const document: StoredApplicationDocument = {
    id,
    applicationId,
    type: "application_pack",
    content: generated.content,
    provider: generated.provider,
    model: generated.model,
    truthfulness,
    profileRevision: profile.updatedAt,
    exports: null,
    exportHashes: null,
    createdAt: now,
    updatedAt: now,
  };
  await userDocument(uid, JOB_AGENT_COLLECTIONS.documents, id).set(document);
  if (application.status === "DRAFT") {
    await updateApplicationStatus(uid, applicationId, { status: "READY_FOR_REVIEW" });
  }
  await recordAuditEvent(uid, {
    applicationId,
    type: "documents_generated",
    metadata: {
      documentId: id,
      provider: generated.provider,
      model: generated.model,
      summary: "Evidence-grounded resume and cover letter generated",
    },
  });
  return publicDocumentView(document);
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function nextUpdatedAt(previous: string) {
  const previousMs = Date.parse(previous);
  return new Date(
    Math.max(Date.now(), Number.isFinite(previousMs) ? previousMs + 1 : 0),
  ).toISOString();
}

export async function editApplicationDocument(
  uid: string,
  applicationId: string,
  input: {
    documentId: string;
    expectedUpdatedAt: string;
    content: GroundedApplicationContent;
  },
) {
  const [{ application }, profile, rawDocument] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
    getRecord<StoredApplicationDocument>(uid, JOB_AGENT_COLLECTIONS.documents, input.documentId),
  ]);
  if (!rawDocument || rawDocument.applicationId !== applicationId) {
    throw new HttpError(404, "Application document not found");
  }
  if (rawDocument.profileRevision !== profile.updatedAt) {
    throw new HttpError(409, "Candidate evidence changed; regenerate the document before editing");
  }
  if (["AUTOFILL_IN_PROGRESS", "SUBMISSION_APPROVED", "SUBMITTED", "WITHDRAWN"].includes(application.status)) {
    throw new HttpError(409, "Document drafts cannot be edited in the current application state");
  }
  const content = groundedApplicationContentSchema.parse(input.content);
  const canonicalContent = groundedApplicationContentSchema.parse(rawDocument.content);
  if (!isCanonicalApplicationContentSelection(content, canonicalContent)) {
    throw new HttpError(
      422,
      "Document edits may only select, remove or reorder exact grounded blocks from the stored draft",
    );
  }
  const truthfulness = validateGroundedStatements(allGroundedStatements(content), profile);
  if (!truthfulness.valid) {
    throw new HttpError(422, "Edited document contains unsupported or contradictory candidate claims");
  }
  const ref = userDocument(uid, JOB_AGENT_COLLECTIONS.documents, input.documentId);
  const applicationRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const profileRef = userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current");
  let updated: StoredApplicationDocument | null = null;
  await adminDb.runTransaction(async (transaction) => {
    const [snapshot, applicationSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(applicationRef),
      transaction.get(profileRef),
    ]);
    if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
    if (["AUTOFILL_IN_PROGRESS", "SUBMISSION_APPROVED", "SUBMITTED", "WITHDRAWN"].includes(
      String(applicationSnapshot.data()?.status),
    )) {
      throw new HttpError(409, "Document drafts cannot be edited in the current application state");
    }
    const currentProfileRevision = profileSnapshot.exists
      ? String(profileSnapshot.data()?.profile?.updatedAt ?? "")
      : himakarCandidateProfile.updatedAt;
    if (currentProfileRevision !== profile.updatedAt) {
      throw new HttpError(409, "Candidate evidence changed during editing; reload before saving");
    }
    if (!snapshot.exists || snapshot.data()?.applicationId !== applicationId) {
      throw new HttpError(404, "Application document not found");
    }
    const current = { id: snapshot.id, ...snapshot.data() } as StoredApplicationDocument;
    if (current.profileRevision !== currentProfileRevision) {
      throw new HttpError(409, "Candidate evidence changed; regenerate the document before editing");
    }
    if (current.updatedAt !== input.expectedUpdatedAt) {
      throw new HttpError(409, "The document changed after it was opened; reload before saving");
    }
    const currentCanonical = groundedApplicationContentSchema.parse(current.content);
    if (!isCanonicalApplicationContentSelection(content, currentCanonical)) {
      throw new HttpError(409, "The canonical document blocks changed; reload before saving");
    }
    const next: StoredApplicationDocument = {
      ...current,
      content,
      provider: "user-edited",
      truthfulness,
      profileRevision: currentProfileRevision,
      exports: null,
      exportHashes: null,
      updatedAt: nextUpdatedAt(current.updatedAt),
    };
    transaction.set(ref, next);
    updated = next;
  });
  if (!updated) throw new HttpError(500, "Application document was not updated");
  const result = updated as StoredApplicationDocument;
  await recordAuditEvent(uid, {
    applicationId,
    type: "documents_edited",
    metadata: {
      documentId: input.documentId,
      contentSha256: sha256(JSON.stringify(content)),
      groundingValid: true,
      summary: "Evidence-grounded application document edited by the user",
    },
  });
  return publicDocumentView(result);
}

function relativeExportPaths(paths: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(paths).map(([key, value]) => {
      const relative = path.relative(process.cwd(), value);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new HttpError(500, "Generated document path is outside the application workspace");
      }
      return [key, relative];
    }),
  );
}

export async function exportApplicationDocuments(
  uid: string,
  applicationId: string,
  documentId: string,
) {
  const [{ application }, profile, rawDocument] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
    getRecord<StoredApplicationDocument>(uid, JOB_AGENT_COLLECTIONS.documents, documentId),
  ]);
  if (!rawDocument || rawDocument.applicationId !== applicationId) {
    throw new HttpError(404, "Application document not found");
  }
  if (rawDocument.profileRevision !== profile.updatedAt) {
    throw new HttpError(409, "Candidate evidence changed; regenerate before export");
  }
  if (rawDocument.truthfulness?.valid !== true) {
    throw new HttpError(409, "Only evidence-grounded documents can be exported");
  }
  const content = groundedApplicationContentSchema.parse(rawDocument.content);
  const truthfulness = validateGroundedStatements(allGroundedStatements(content), profile);
  if (!truthfulness.valid) {
    throw new HttpError(409, "Document evidence changed; regenerate before export");
  }

  const pack: GroundedApplicationPack = {
    applicationId,
    candidateName: profile.preferredName,
    company: application.company,
    role: application.role,
    location: `${profile.location.city}, ${profile.location.state}`,
    workRights: profile.workRights.fullWorkingRights
      ? `${profile.workRights.visa}, subclass ${profile.workRights.visaSubclass}; full Australian working rights subject to current visa conditions`
      : undefined,
    summary: content.summary.text,
    skills: content.skills.map((skill) => skill.name),
    sections: content.sections.map((section) => ({
      heading: section.heading,
      title: section.title,
      subtitle: section.subtitle,
      bullets: section.bullets.map((bullet) => bullet.text),
    })),
    education: content.education.map((education) => ({
      degree: education.degree,
      institution: education.institution,
      period: education.period,
    })),
    coverLetter: content.coverLetterParagraphs.map((paragraph) => paragraph.text).join("\n\n"),
  };
  const exported = await exportGroundedApplicationDocuments(pack);
  const files = relativeExportPaths(exported);
  const exportHashes = Object.fromEntries(await Promise.all(
    applicationExportKinds.map(async (kind) => {
      const file = await readGeneratedApplicationExport({
        workspaceRoot: process.cwd(),
        applicationId,
        storedPath: files[kind],
        kind,
      });
      return [kind, sha256(file.bytes)] as const;
    }),
  ));
  const ref = userDocument(uid, JOB_AGENT_COLLECTIONS.documents, documentId);
  const profileRef = userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current");
  const sourceContentHash = sha256(JSON.stringify(content));
  let updated: StoredApplicationDocument | null = null;
  await adminDb.runTransaction(async (transaction) => {
    const [documentSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(profileRef),
    ]);
    if (!documentSnapshot.exists || documentSnapshot.data()?.applicationId !== applicationId) {
      throw new HttpError(404, "Application document not found");
    }
    const currentProfileRevision = profileSnapshot.exists
      ? String(profileSnapshot.data()?.profile?.updatedAt ?? "")
      : himakarCandidateProfile.updatedAt;
    const current = {
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    } as StoredApplicationDocument;
    const currentContent = groundedApplicationContentSchema.parse(current.content);
    if (
      currentProfileRevision !== profile.updatedAt
      || current.profileRevision !== currentProfileRevision
    ) {
      throw new HttpError(409, "Candidate evidence changed; regenerate before export");
    }
    if (
      current.updatedAt !== rawDocument.updatedAt
      || sha256(JSON.stringify(currentContent)) !== sourceContentHash
    ) {
      throw new HttpError(409, "The document changed during export; export the current draft again");
    }
    const next: StoredApplicationDocument = {
      ...current,
      content: currentContent,
      truthfulness,
      profileRevision: currentProfileRevision,
      exports: files,
      exportHashes,
      updatedAt: nextUpdatedAt(current.updatedAt),
    };
    transaction.set(ref, next);
    updated = next;
  });
  if (!updated) throw new HttpError(500, "Application document export was not recorded");
  return { document: publicDocumentView(updated as StoredApplicationDocument) };
}

export async function downloadApplicationDocument(
  uid: string,
  applicationId: string,
  documentId: string,
  kind: ApplicationExportKind,
) {
  const [, profile, document] = await Promise.all([
    getStoredApplication(uid, applicationId),
    getCandidateProfile(uid),
    getRecord<StoredApplicationDocument>(uid, JOB_AGENT_COLLECTIONS.documents, documentId),
  ]);
  if (!document || document.applicationId !== applicationId) {
    throw new HttpError(404, "Application document not found");
  }
  if (document.profileRevision !== profile.updatedAt) {
    throw new HttpError(409, "Candidate evidence changed; regenerate before downloading");
  }
  const storedPath = document.exports?.[kind];
  const expectedHash = document.exportHashes?.[kind];
  if (!storedPath || !expectedHash) {
    throw new HttpError(409, "Export this document again before downloading it");
  }
  const content = groundedApplicationContentSchema.parse(document.content);
  if (!validateGroundedStatements(allGroundedStatements(content), profile).valid) {
    throw new HttpError(409, "Document evidence changed; regenerate before downloading");
  }
  let file;
  try {
    file = await readGeneratedApplicationExport({
      workspaceRoot: process.cwd(),
      applicationId,
      storedPath,
      kind,
    });
  } catch {
    throw new HttpError(404, "Generated export is unavailable");
  }
  if (sha256(file.bytes) !== expectedHash) {
    throw new HttpError(409, "Generated export failed its integrity check; export it again");
  }
  const documentRef = userDocument(uid, JOB_AGENT_COLLECTIONS.documents, documentId);
  const applicationRef = userDocument(uid, JOB_AGENT_COLLECTIONS.applications, applicationId);
  const profileRef = userDocument(uid, JOB_AGENT_COLLECTIONS.profile, "current");
  await adminDb.runTransaction(async (transaction) => {
    const [applicationSnapshot, documentSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(applicationRef),
      transaction.get(documentRef),
      transaction.get(profileRef),
    ]);
    if (!applicationSnapshot.exists) throw new HttpError(404, "Application not found");
    if (!documentSnapshot.exists || documentSnapshot.data()?.applicationId !== applicationId) {
      throw new HttpError(404, "Application document not found");
    }
    const currentProfileRevision = profileSnapshot.exists
      ? String(profileSnapshot.data()?.profile?.updatedAt ?? "")
      : himakarCandidateProfile.updatedAt;
    const current = {
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    } as StoredApplicationDocument;
    if (
      currentProfileRevision !== profile.updatedAt
      || current.profileRevision !== currentProfileRevision
      || current.updatedAt !== document.updatedAt
      || current.exports?.[kind] !== storedPath
      || current.exportHashes?.[kind] !== expectedHash
    ) {
      throw new HttpError(409, "The document or candidate evidence changed during download; retry");
    }
  });
  return file;
}
