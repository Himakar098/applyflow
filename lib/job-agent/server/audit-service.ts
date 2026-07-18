import "server-only";

import { createAuditEvent, type AuditEvent } from "@/lib/job-agent";
import {
  JOB_AGENT_COLLECTIONS,
  listRecords,
  userCollection,
  userDocument,
} from "@/lib/job-agent/server/store";

export async function recordAuditEvent(
  uid: string,
  input: {
    applicationId?: string | null;
    type: AuditEvent["type"];
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  },
) {
  const id = `audit-${crypto.randomUUID()}`;
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const event = createAuditEvent({
    id,
    applicationId: input.applicationId,
    type: input.type,
    actorId: uid,
    occurredAt,
    metadata: input.metadata,
  });
  await userDocument(uid, JOB_AGENT_COLLECTIONS.audit, id).set({
    ...event,
    createdAt: occurredAt,
  });
  return { ...event, createdAt: occurredAt, action: event.type };
}

export async function listAuditEvents(
  uid: string,
  options: { applicationId?: string; limit?: number } = {},
) {
  let query = userCollection(uid, JOB_AGENT_COLLECTIONS.audit)
    .orderBy("occurredAt", "desc")
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 200));
  if (options.applicationId) {
    query = userCollection(uid, JOB_AGENT_COLLECTIONS.audit)
      .where("applicationId", "==", options.applicationId)
      .orderBy("occurredAt", "desc")
      .limit(Math.min(Math.max(options.limit ?? 100, 1), 200));
  }
  const events = await listRecords<AuditEvent & { createdAt?: string }>(query);
  return events.map((event) => ({
    ...event,
    action: event.type,
    createdAt: event.occurredAt,
    summary: typeof event.metadata?.summary === "string"
      ? event.metadata.summary
      : event.type.replaceAll("_", " "),
  }));
}

