import {
  editApplicationDocument,
  generateApplicationDocuments,
  listApplicationDocuments,
} from "@/lib/job-agent/server/document-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  editApplicationDocumentSchema,
  generateDocumentsSchema,
} from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

async function applicationIdFrom(context: { params: Promise<{ applicationId: string }> }) {
  return requireSafeId((await context.params).applicationId, "application id");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const documents = await listApplicationDocuments(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, documents, digest });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const raw = request.headers.get("content-length") === "0"
      ? {}
      : await readLimitedJson(request);
    const body = generateDocumentsSchema.parse(raw);
    const document = await generateApplicationDocuments(
      uid,
      await applicationIdFrom(context),
      body,
    );
    return jobAgentJson({ ok: true, document, digest }, 201);
  }, { mutation: true, limit: 8, windowMs: 60_000, rateKey: "document-generate" });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = editApplicationDocumentSchema.parse(await readLimitedJson(request));
    const document = await editApplicationDocument(
      uid,
      await applicationIdFrom(context),
      body,
    );
    return jobAgentJson({ ok: true, document, digest });
  }, { mutation: true, limit: 20, rateKey: "document-edit" });
}
