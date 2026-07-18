import {
  generateFollowUpMaterials,
  getLatestFollowUpMaterials,
} from "@/lib/job-agent/server/follow-up-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";

export const runtime = "nodejs";

async function applicationIdFrom(context: { params: Promise<{ applicationId: string }> }) {
  return requireSafeId((await context.params).applicationId, "application id");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const draft = await getLatestFollowUpMaterials(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, draft, digest });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const draft = await generateFollowUpMaterials(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, draft, digest }, 201);
  }, { mutation: true, limit: 8, windowMs: 60_000, rateKey: "follow-up-generate" });
}

