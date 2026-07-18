import {
  downloadApplicationDocument,
  exportApplicationDocuments,
} from "@/lib/job-agent/server/document-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  downloadApplicationDocumentSchema,
  exportDocumentsSchema,
} from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid }) => {
    const applicationId = requireSafeId((await context.params).applicationId, "application id");
    const url = new URL(request.url);
    const query = downloadApplicationDocumentSchema.parse({
      documentId: url.searchParams.get("documentId"),
      kind: url.searchParams.get("kind"),
    });
    const file = await downloadApplicationDocument(
      uid,
      applicationId,
      query.documentId,
      query.kind,
    );
    const fileName = file.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": file.contentType,
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }, { limit: 30, rateKey: "document-download" });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const applicationId = requireSafeId((await context.params).applicationId, "application id");
    const body = exportDocumentsSchema.parse(await readLimitedJson(request));
    const result = await exportApplicationDocuments(uid, applicationId, body.documentId);
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 12, rateKey: "document-export" });
}
