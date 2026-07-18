"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileOutput, Loader2, Pencil, WandSparkles } from "lucide-react";

import { DocumentBlockEditor, type GroundedContent } from "@/components/job-agent/document-block-editor";
import { PageHeading } from "@/components/job-agent/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { jobAgentDownload, jobAgentRequest, unwrapList, unwrapRecord } from "@/lib/job-agent/client";

type ExportKind = "resumePdf" | "resumeDocx" | "coverLetterPdf" | "coverLetterDocx";

const exportLabels: Record<ExportKind, string> = {
  resumePdf: "Resume PDF",
  resumeDocx: "Resume DOCX",
  coverLetterPdf: "Cover letter PDF",
  coverLetterDocx: "Cover letter DOCX",
};

type GeneratedDocument = {
  id?: string;
  type?: string;
  fileName?: string;
  title?: string;
  content?: GroundedContent;
  resume?: { summary?: string; sections?: Array<{ heading?: string; bullets?: string[] }> };
  coverLetter?: { content?: string; body?: string };
  files?: Array<{ type?: string; fileName?: string; path?: string }>;
  exports?: Record<string, string> | null;
  exportHashes?: Record<string, string> | null;
  createdAt?: string;
  updatedAt?: string;
};

export function DocumentsPanel({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/documents`);
      setDocuments(unwrapList<GeneratedDocument>(payload, ["documents"]));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load documents");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/documents`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const document = unwrapRecord<GeneratedDocument>(payload, ["document"]);
      if (document) setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      toast({
        title: "Grounded application pack generated",
        description: "Review all content before exporting or autofilling.",
      });
    } catch (generationError) {
      toast({
        title: "Document generation failed",
        description: generationError instanceof Error ? generationError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const exportDocument = async (document: GeneratedDocument) => {
    if (!document.id) return;
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/documents/export`, {
        method: "POST",
        body: JSON.stringify({ documentId: document.id }),
      });
      const exported = unwrapRecord<GeneratedDocument>(payload, ["document"]);
      const fileRecord = (payload as { files?: Record<string, string> }).files ?? {};
      const files = Object.entries(fileRecord).map(([type, path]) => ({
        type,
        path,
        fileName: path.split("/").at(-1),
      }));
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, ...exported, files } : item));
      toast({
        title: "DOCX and PDF created",
        description: "Files were written to the private generated-application directory.",
      });
    } catch (exportError) {
      toast({
        title: "Export failed",
        description: exportError instanceof Error ? exportError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const saveDocument = async (document: GeneratedDocument, content: GroundedContent) => {
    if (!document.id || !document.updatedAt) return;
    setWorking(true);
    try {
      const payload = await jobAgentRequest<unknown>(`/api/job-agent/applications/${applicationId}/documents`, {
        method: "PATCH",
        body: JSON.stringify({
          documentId: document.id,
          expectedUpdatedAt: document.updatedAt,
          content,
        }),
      });
      const updated = unwrapRecord<GeneratedDocument>(payload, ["document"]);
      if (updated) {
        setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, ...updated, files: [] } : item));
      }
      setEditingId(null);
      toast({
        title: "Grounded blocks updated",
        description: "Previous exports were invalidated. Export the reviewed version when ready.",
      });
    } catch (saveError) {
      toast({
        title: "Document edit failed",
        description: saveError instanceof Error ? saveError.message : "Reload and try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const downloadExport = async (document: GeneratedDocument, kind: ExportKind) => {
    if (!document.id) return;
    setWorking(true);
    try {
      const query = new URLSearchParams({ documentId: document.id, kind });
      const { blob, fileName } = await jobAgentDownload(
        `/api/job-agent/applications/${applicationId}/documents/export?${query.toString()}`,
        `${kind}.${kind.endsWith("Pdf") ? "pdf" : "docx"}`,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (downloadError) {
      toast({
        title: "Download failed",
        description: downloadError instanceof Error ? downloadError.message : "Export again and retry.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Grounded documents"
        title="Tailored resume and cover letter"
        description="The generator selects and reorders verified evidence. It cannot add metrics, qualifications, employers, or dates that are absent from the candidate profile."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/applications/${applicationId}`}>Back to application</Link></Button>
            <Button onClick={generate} disabled={working}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
              Generate new pack
            </Button>
          </>
        }
      />

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex gap-3 p-4 text-sm text-blue-950">
          <FileOutput className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Generated text is a draft. Confirm every claim, date, title, and work-right answer before using it on an employer portal.</p>
        </CardContent>
      </Card>

      {loading ? <Skeleton className="h-80 w-full rounded-xl" /> : error ? (
        <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle>Documents unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader></Card>
      ) : documents.length === 0 ? (
        <Card className="surface-card"><CardContent className="p-10 text-center"><p className="font-medium">No application pack yet</p><p className="mt-1 text-sm text-muted-foreground">Generate a grounded draft, review it here, then export DOCX and PDF.</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {documents.map((document, index) => (
            <Card key={document.id ?? index} className="surface-card">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><CardTitle>{document.title ?? document.fileName ?? "Application pack"}</CardTitle><CardDescription>{document.createdAt ? new Date(document.createdAt).toLocaleString() : "Generated draft"}</CardDescription></div>
                <div className="flex flex-wrap gap-2">
                  {document.content && document.updatedAt ? (
                    <Button variant="outline" onClick={() => setEditingId(document.id ?? null)} disabled={working || editingId === document.id}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit grounded blocks
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => exportDocument(document)} disabled={working || !document.id}>
                    <Download className="mr-2 h-4 w-4" /> Export DOCX + PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {editingId === document.id && document.content ? (
                  <DocumentBlockEditor
                    key={`${document.id}-${document.updatedAt}`}
                    content={document.content}
                    busy={working}
                    onCancel={() => setEditingId(null)}
                    onSave={(content) => saveDocument(document, content)}
                  />
                ) : null}
                {document.resume?.summary ? <section><h3 className="mb-2 font-semibold">Resume summary</h3><p className="whitespace-pre-wrap text-sm leading-6">{document.resume.summary}</p></section> : null}
                {document.resume?.sections?.map((section, sectionIndex) => (
                  <section key={`${section.heading}-${sectionIndex}`} className="rounded-xl border p-4">
                    <h3 className="font-semibold">{section.heading ?? "Resume section"}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{section.bullets?.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  </section>
                ))}
                {document.coverLetter?.content || document.coverLetter?.body ? <section><h3 className="mb-2 font-semibold">Cover letter</h3><div className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-4 text-sm leading-6">{document.coverLetter.content ?? document.coverLetter.body}</div></section> : null}
                {document.content?.summary?.text ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Resume summary</h3>
                    <p className="text-sm leading-6">{document.content.summary.text}</p>
                  </section>
                ) : null}
                {document.content?.skills?.length ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Selected skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {document.content.skills.map((skill, skillIndex) => (
                        <span key={`${skill.name}-${skillIndex}`} className="rounded-md border bg-muted/30 px-2 py-1 text-xs">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}
                {document.content?.sections?.map((section, sectionIndex) => (
                  <section key={`${section.heading}-${sectionIndex}`} className="rounded-xl border p-4">
                    <h3 className="font-semibold">{section.heading}</h3>
                    <p className="text-sm font-medium">{section.title}</p>
                    {section.subtitle ? <p className="text-xs text-muted-foreground">{section.subtitle}</p> : null}
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {section.bullets?.map((bullet, bulletIndex) => (
                        <li key={`${bullet.text}-${bulletIndex}`}>{bullet.text}</li>
                      ))}
                    </ul>
                  </section>
                ))}
                {document.content?.education?.length ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Education</h3>
                    <div className="space-y-2 text-sm">
                      {document.content.education.map((education, educationIndex) => (
                        <p key={`${education.degree}-${educationIndex}`}>
                          <strong>{education.degree}</strong>, {education.institution}
                          {education.period ? ` · ${education.period}` : ""}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}
                {document.content?.coverLetterParagraphs?.length ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Cover letter</h3>
                    <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm leading-6">
                      {document.content.coverLetterParagraphs.map((paragraph, paragraphIndex) => (
                        <p key={`${paragraph.text}-${paragraphIndex}`}>{paragraph.text}</p>
                      ))}
                    </div>
                  </section>
                ) : null}
                {document.content?.selectionCriteria?.length ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Selection criteria</h3>
                    <div className="space-y-3">
                      {document.content.selectionCriteria.map((criterion, criterionIndex) => (
                        <div key={`${criterion.criterion}-${criterionIndex}`} className="rounded-xl border p-4">
                          <p className="font-medium">{criterion.criterion}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm">{criterion.response?.text}</p>
                          {criterion.factsNeedingConfirmation?.length ? (
                            <p className="mt-2 text-xs text-amber-700">
                              Needs confirmation: {criterion.factsNeedingConfirmation.join("; ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {document.files?.length ? (
                  <div className="rounded-xl border bg-emerald-50 p-4"><p className="text-sm font-medium text-emerald-950">Private exports</p><ul className="mt-2 space-y-1 text-xs text-emerald-900">{document.files.map((file) => <li key={file.path ?? file.fileName}>{file.fileName ?? file.path} ({file.type ?? "file"})</li>)}</ul></div>
                ) : null}
                {document.exports ? (
                  <div className="rounded-xl border bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-950">Download private exports</p>
                    <p className="mt-1 text-xs text-emerald-900">Downloads are authenticated and checked against the current document hash.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(exportLabels) as ExportKind[]).map((kind) => document.exports?.[kind] ? (
                        <Button key={kind} type="button" size="sm" variant="outline" disabled={working} onClick={() => void downloadExport(document, kind)}>
                          <Download className="mr-2 h-4 w-4" /> {exportLabels[kind]}
                        </Button>
                      ) : null)}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
