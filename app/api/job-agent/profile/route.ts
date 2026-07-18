import { readLimitedJson } from "@/lib/security/job-agent-request";
import { jobAgentJson, withJobAgentRoute } from "@/lib/job-agent/server/http";
import {
  readCandidateProfile,
  saveCandidateProfile,
} from "@/lib/job-agent/server/profile-service";
import { profileUpdateSchema } from "@/lib/job-agent/server/request-schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const result = await readCandidateProfile(uid);
    return jobAgentJson({ ok: true, ...result, digest });
  });
}

export async function PUT(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const body = profileUpdateSchema.parse(await readLimitedJson(request));
    const result = await saveCandidateProfile(
      uid,
      body.profile,
      body.privateContact,
      body.confirmedClaimIds,
    );
    return jobAgentJson({ ok: true, ...result, digest });
  }, { mutation: true, limit: 20, rateKey: "profile-write" });
}
