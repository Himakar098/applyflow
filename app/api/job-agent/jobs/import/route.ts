import { jobAgentJson, withJobAgentRoute } from "@/lib/job-agent/server/http";
import { importJobs } from "@/lib/job-agent/server/job-service";
import { jobImportSchema } from "@/lib/job-agent/server/request-schemas";
import { readLimitedJson } from "@/lib/security/job-agent-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withJobAgentRoute(request, async ({ uid, digest }) => {
    const input = jobImportSchema.parse(await readLimitedJson(request, 1_100_000));
    const jobs = await importJobs(uid, input);
    return jobAgentJson({
      ok: true,
      jobs,
      importedCount: jobs.length,
      digest,
    }, 201);
  }, { mutation: true, limit: 10, rateKey: "job-import" });
}

