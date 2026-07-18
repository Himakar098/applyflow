import {
  auditEventSchema,
  type AuditEvent,
} from "./schemas";

export const REDACTED_AUDIT_VALUE = "[REDACTED]";
const REDACTED = REDACTED_AUDIT_VALUE;
const SENSITIVE_KEY = /(?:api[-_]?key|password|passwd|secret|authorization|access[-_]?token|refresh[-_]?token|id[-_]?token|session(?:id|cookie|token)?|cookie|private[-_]?key|client[-_]?secret)/i;

function redactString(value: string): string {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) return REDACTED;
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, REDACTED)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, `Bearer ${REDACTED}`)
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}\b/gi, `Basic ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/:\/\/[^:@/\s]+:[^@/\s]+@/g, `://${REDACTED}@`)
    .replace(/\b(?:sessionid|session|cookie|set-cookie)=([^;\s]+)/gi, (entry) => `${entry.split("=")[0]}=${REDACTED}`)
    .replace(/([?&](?:token|key|secret|password|session)=)[^&#\s]+/gi, `$1${encodeURIComponent(REDACTED)}`);
}

/** Returns a redacted clone; the caller's metadata is never mutated. */
export function redactAuditMetadata(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (depth > 12) return "[TRUNCATED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditMetadata(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactAuditMetadata(childValue, childKey, depth + 1),
      ]),
    );
  }
  return value;
}

export function createAuditEvent(input: {
  id: string;
  applicationId?: string | null;
  type: AuditEvent["type"];
  actorId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}): AuditEvent {
  return auditEventSchema.parse({
    id: input.id,
    applicationId: input.applicationId ?? null,
    type: input.type,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    metadata: redactAuditMetadata(input.metadata ?? {}),
  });
}

export function containsUnredactedSecret(value: unknown): boolean {
  const serialised = JSON.stringify(value);
  return /\bsk-[A-Za-z0-9_-]{10,}\b/.test(serialised)
    || /\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}\b/i.test(serialised)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(serialised);
}
