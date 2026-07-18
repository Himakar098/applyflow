import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import { readJob } from "@/lib/job-agent/server/job-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const { jobId: rawJobId } = await context.params;
    const jobId = requireSafeId(rawJobId, "job id");
    const result = await readJob(uid, jobId);
    return jobAgentJson({ ok: true, ...result, digest });
  });
}

