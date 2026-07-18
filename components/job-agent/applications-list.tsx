"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Loader2 } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { StatusPill } from "@/components/job-agent/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/firebase/getIdToken";
import {
  type JobAgentApplication,
  jobAgentRequest,
  unwrapList,
} from "@/lib/job-agent/client";

export function ApplicationsList() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<JobAgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jobAgentRequest<unknown>("/api/job-agent/applications?limit=100")
      .then((payload) => {
        if (active) setApplications(unwrapList<JobAgentApplication>(payload, ["applications"]));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load applications");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) throw new Error("Your session has expired");
      const response = await fetch("/api/job-agent/applications/export", { headers });
      if (!response.ok) throw new Error("CSV export failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "applyflow-applications.csv";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Application CSV exported" });
    } catch (exportError) {
      toast({
        title: "Export failed",
        description: exportError instanceof Error ? exportError.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Application tracker"
        title="Every application, document, answer, and approval in one place."
        description="Statuses reflect supervised progress. A prepared or autofilled form is never treated as submitted until the portal result is recorded."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button asChild><Link href="/jobs/new">Import job</Link></Button>
          </>
        }
      />

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Open a record to review its grounded evidence and approval history.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>
          ) : applications.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">No supervised applications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Assess an eligible job, then choose Start application.</p>
              <Button asChild className="mt-4"><Link href="/jobs/new">Import your first job</Link></Button>
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-white/70">
              {applications.map((application) => (
                <Link
                  key={application.id}
                  href={`/applications/${application.id}`}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{application.role ?? application.title ?? "Untitled role"}</p>
                    <p className="truncate text-sm text-muted-foreground">{application.company ?? "Unknown company"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {typeof application.fitScore === "number" ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">{application.fitScore}/100</span>
                    ) : null}
                    <StatusPill value={application.eligibility} />
                    <StatusPill value={application.status} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

