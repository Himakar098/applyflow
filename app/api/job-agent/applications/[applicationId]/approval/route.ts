import {
  consumeFinalSubmissionApproval,
  getSubmissionApproval,
  grantFinalSubmissionApproval,
  revokeFinalSubmissionApproval,
} from "@/lib/job-agent/server/application-service";
import {
  assertJobAgentWorkerRequest,
  jobAgentJson,
  requireSafeId,
  withJobAgentRoute,
} from "@/lib/job-agent/server/http";
import { submissionApprovalSchema } from "@/lib/job-agent/server/request-schemas";
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
    const approval = await getSubmissionApproval(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, approval, digest });
  });
}

/** Explicit user action grants a short-lived, plan-bound approval. */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = submissionApprovalSchema.parse(await readLimitedJson(request));
    const result = await grantFinalSubmissionApproval(
      uid,
      await applicationIdFrom(context),
      body.planHash,
    );
    return jobAgentJson({ ok: true, ...result, digest }, 201);
  }, { mutation: true, limit: 12, rateKey: "submission-approval-grant" });
}

/** Visible worker consumes the approval immediately before pressing Submit. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    assertJobAgentWorkerRequest(request);
    const body = submissionApprovalSchema.parse(await readLimitedJson(request));
    const result = await consumeFinalSubmissionApproval(
      uid,
      await applicationIdFrom(context),
      body.planHash,
    );
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 12, rateKey: "submission-approval-consume" });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const result = await revokeFinalSubmissionApproval(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 12, rateKey: "submission-approval-revoke" });
}
