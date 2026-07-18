import { HttpError } from "@/lib/auth/verify-id-token";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  assessmentView,
  getStoredAssessment,
  getStoredJob,
  recomputeAssessment,
} from "@/lib/job-agent/server/job-service";

export const runtime = "nodejs";

async function jobIdFrom(context: { params: Promise<{ jobId: string }> }) {
  return requireSafeId((await context.params).jobId, "job id");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const jobId = await jobIdFrom(context);
    await getStoredJob(uid, jobId);
    const stored = await getStoredAssessment(uid, jobId);
    if (!stored) throw new HttpError(404, "Assessment not found");
    return jobAgentJson({ ok: true, assessment: assessmentView(stored), digest });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const assessment = await recomputeAssessment(uid, await jobIdFrom(context));
    return jobAgentJson({ ok: true, assessment, digest });
  }, { mutation: true, limit: 20, rateKey: "assessment-recompute" });
}

