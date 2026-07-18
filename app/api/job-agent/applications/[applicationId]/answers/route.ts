import {
  listApplicationAnswers,
  proposeApplicationAnswers,
  updateApplicationAnswers,
} from "@/lib/job-agent/server/answer-service";
import { jobAgentJson, requireSafeId, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  generateAnswersSchema,
  updateAnswersSchema,
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
    const answers = await listApplicationAnswers(uid, await applicationIdFrom(context));
    return jobAgentJson({ ok: true, answers, digest });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = generateAnswersSchema.parse(await readLimitedJson(request));
    const answers = await proposeApplicationAnswers(
      uid,
      await applicationIdFrom(context),
      body.questions,
    );
    return jobAgentJson({ ok: true, answers, digest }, 201);
  }, { mutation: true, limit: 30, rateKey: "answers-generate" });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = updateAnswersSchema.parse(await readLimitedJson(request));
    const answers = await updateApplicationAnswers(
      uid,
      await applicationIdFrom(context),
      body.answers,
    );
    return jobAgentJson({ ok: true, answers, digest });
  }, { mutation: true, limit: 60, rateKey: "answers-update" });
}

export const PATCH = PUT;

