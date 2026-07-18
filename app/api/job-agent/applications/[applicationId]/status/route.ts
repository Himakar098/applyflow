import { updateApplicationStatus } from "@/lib/job-agent/server/application-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import { applicationStatusUpdateSchema } from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const applicationId = requireSafeId((await context.params).applicationId, "application id");
    const body = applicationStatusUpdateSchema.parse(await readLimitedJson(request));
    const application = await updateApplicationStatus(uid, applicationId, body);
    return jobAgentJson({ ok: true, application, digest });
  }, { mutation: true, limit: 60, rateKey: "application-status" });
}

export const PATCH = PUT;

