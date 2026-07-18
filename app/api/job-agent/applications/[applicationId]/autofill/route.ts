import {
  handleAutofillAction,
  readAutofillState,
} from "@/lib/job-agent/server/application-service";
import {
  assertJobAgentWorkerRequest,
  jobAgentJson,
  requireSafeId,
  withJobAgentRoute,
} from "@/lib/job-agent/server/http";
import { autofillActionSchema } from "@/lib/job-agent/server/request-schemas";
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
    const workerRequested = request.headers.has("x-job-agent-worker-token");
    if (workerRequested) assertJobAgentWorkerRequest(request);
    const result = await readAutofillState(
      uid,
      await applicationIdFrom(context),
      { includeWorkerValues: workerRequested },
    );
    return jobAgentJson({ ok: true, ...result, digest });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = autofillActionSchema.parse(await readLimitedJson(request, 1_000_000));
    if (body.action === "save_plan" || body.action === "ready_to_submit") {
      assertJobAgentWorkerRequest(request);
    }
    const result = await handleAutofillAction(
      uid,
      await applicationIdFrom(context),
      body,
    );
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 60, rateKey: "autofill-action" });
}
