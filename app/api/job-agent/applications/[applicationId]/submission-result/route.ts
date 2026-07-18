import {
  getSubmissionAttempt,
  manuallyResolveSubmissionResult,
  recordWorkerSubmissionResult,
} from "@/lib/job-agent/server/application-service";
import {
  assertJobAgentWorkerRequest,
  jobAgentJson,
  requireSafeId,
  withJobAgentRoute,
} from "@/lib/job-agent/server/http";
import {
  manualSubmissionResolutionSchema,
  submissionResultInputSchema,
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
    const attempt = await getSubmissionAttempt(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, attempt, digest });
  });
}

/** Authenticated local worker callback; the completion token is single-use. */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    assertJobAgentWorkerRequest(request);
    const body = submissionResultInputSchema.parse(await readLimitedJson(request));
    const result = await recordWorkerSubmissionResult(
      uid,
      await applicationIdFrom(context),
      body,
    );
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 12, rateKey: "submission-result-worker" });
}

/** Explicit owner resolution when the worker reports an ambiguous portal outcome. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = manualSubmissionResolutionSchema.parse(await readLimitedJson(request));
    const result = await manuallyResolveSubmissionResult(
      uid,
      await applicationIdFrom(context),
      body,
    );
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 6, rateKey: "submission-result-manual-confirm" });
}
