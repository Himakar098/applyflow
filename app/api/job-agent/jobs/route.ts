import { HttpError } from "@/lib/auth/verify-id-token";
import { jobAgentJson, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  createAndAssessJob,
  listJobs,
} from "@/lib/job-agent/server/job-service";
import { pastedJobSchema } from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const url = new URL(request.url);
    const eligibility = url.searchParams.get("eligibility") ?? undefined;
    if (eligibility && !["eligible", "ineligible", "needs_review"].includes(eligibility)) {
      throw new HttpError(400, "Invalid eligibility filter");
    }
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
    const jobs = await listJobs(uid, { eligibility, limit });
    return jobAgentJson({ ok: true, jobs, digest });
  });
}

export async function POST(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const input = pastedJobSchema.parse(await readLimitedJson(request));
    const job = await createAndAssessJob(uid, input);
    return jobAgentJson({ ok: true, job, assessment: job.assessment, digest }, 201);
  }, { mutation: true, limit: 20, rateKey: "job-create" });
}

