import {
  readApplication,
  updateApplicationTracking,
} from "@/lib/job-agent/server/application-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import { applicationTrackingUpdateSchema } from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const applicationId = requireSafeId((await context.params).applicationId, "application id");
    const result = await readApplication(uid, applicationId);
    return jobAgentJson({ ok: true, ...result, digest });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const applicationId = requireSafeId((await context.params).applicationId, "application id");
    const updates = applicationTrackingUpdateSchema.parse(await readLimitedJson(request));
    const application = await updateApplicationTracking(uid, applicationId, updates);
    return jobAgentJson({ ok: true, application, digest });
  }, { mutation: true, limit: 60, rateKey: "application-tracking" });
}

export const PUT = PATCH;
