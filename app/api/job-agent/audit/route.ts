import { listAuditEvents } from "@/lib/job-agent/server/audit-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const url = new URL(request.url);
    const rawApplicationId = url.searchParams.get("applicationId");
    const applicationId = rawApplicationId
      ? requireSafeId(rawApplicationId, "application id")
      : undefined;
    const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
    const events = await listAuditEvents(uid, {
      applicationId,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 100,
    });
    return jobAgentJson({ ok: true, events, digest });
  });
}

