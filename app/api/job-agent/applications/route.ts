import { HttpError } from "@/lib/auth/verify-id-token";
import { applicationStateSchema } from "@/lib/job-agent";
import {
  createApplication,
  listApplications,
} from "@/lib/job-agent/server/application-service";
import { jobAgentJson, withJobAgentRoute } from "@/lib/job-agent/server/http";
import { createApplicationSchema } from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus ? applicationStateSchema.safeParse(rawStatus) : null;
    if (status && !status.success) throw new HttpError(400, "Invalid application status filter");
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const applications = await listApplications(uid, {
      status: status?.success ? status.data : undefined,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 50,
    });
    return jobAgentJson({ ok: true, applications, digest });
  });
}

export async function POST(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = createApplicationSchema.parse(await readLimitedJson(request));
    const application = await createApplication(uid, body.jobId);
    return jobAgentJson({ ok: true, application, digest }, 201);
  }, { mutation: true, limit: 30, rateKey: "application-create" });
}

