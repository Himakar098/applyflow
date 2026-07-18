"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";

import { PageHeading } from "@/components/job-agent/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AuditEvent,
  humanize,
  jobAgentRequest,
  unwrapList,
} from "@/lib/job-agent/client";

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void jobAgentRequest<unknown>("/api/job-agent/audit?limit=200")
      .then((payload) => {
        if (active) setEvents(unwrapList<AuditEvent>(payload, ["events"]));
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load audit events",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Audit log"
        title="A redacted record of every important decision and side effect."
        description="Events include job capture, eligibility, scoring, document generation, browser activity, answer changes, approvals, and submission results. Passwords, API keys, cookies, and unnecessary sensitive values are never logged."
      />
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> Recent events
          </CardTitle>
          <CardDescription>Newest events first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          ) : events.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No Job Agent events have been recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const timestamp = event.occurredAt ?? event.createdAt;
                return (
                  <div key={event.id} className="rounded-xl border bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {humanize(event.type ?? event.action)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {event.summary ?? "Recorded by the Job Agent"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.applicationId ? (
                          <Badge variant="outline">
                            Application {event.applicationId.slice(0, 8)}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {timestamp
                            ? new Date(timestamp).toLocaleString()
                            : "Time unavailable"}
                        </span>
                      </div>
                    </div>
                    {event.metadata && Object.keys(event.metadata).length ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-primary">
                          Show redacted metadata
                        </summary>
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
