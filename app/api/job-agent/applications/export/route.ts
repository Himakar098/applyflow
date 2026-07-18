import { applicationStateSchema } from "@/lib/job-agent";
import { HttpError } from "@/lib/auth/verify-id-token";
import { exportApplicationsCsv } from "@/lib/job-agent/server/application-service";
import { withJobAgentRoute } from "@/lib/job-agent/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withJobAgentRoute(request, async ({ uid }) => {
    const rawStatus = new URL(request.url).searchParams.get("status");
    const status = rawStatus ? applicationStateSchema.safeParse(rawStatus) : null;
    if (status && !status.success) throw new HttpError(400, "Invalid application status filter");
    const csv = await exportApplicationsCsv(uid, status?.success ? status.data : undefined);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applyflow-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }, { limit: 20, rateKey: "application-csv-export" });
}

