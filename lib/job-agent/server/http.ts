import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { HttpError, verifyIdToken } from "@/lib/auth/verify-id-token";
import { assertSameOrigin } from "@/lib/security/job-agent-request";
import { checkRateLimit } from "@/lib/security/rate-limit";

type RouteContext = {
  uid: string;
  digest: string;
};

type RouteOptions = {
  mutation?: boolean;
  limit?: number;
  windowMs?: number;
  rateKey?: string;
};

type RouteResult = NextResponse | Response;

const DEFAULT_LIMIT = 120;
const DEFAULT_WINDOW_MS = 60_000;

function conciseZodError(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Request validation failed";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `Request validation failed: ${path}${issue.message}`.slice(0, 240);
}

export function jobAgentJson(
  body: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

/**
 * Central authenticated route boundary for Job Agent APIs. It deliberately
 * logs only a request digest and error class; request bodies and secrets never
 * enter server logs.
 */
export async function withJobAgentRoute(
  request: Request,
  handler: (context: RouteContext) => Promise<RouteResult>,
  options: RouteOptions = {},
) {
  const digest = crypto.randomUUID();

  try {
    if (options.mutation) assertSameOrigin(request);

    const { uid } = await verifyIdToken(request);
    const rate = checkRateLimit({
      key: [
        "job-agent",
        options.rateKey ?? new URL(request.url).pathname,
        uid,
      ].join(":"),
      limit: options.limit ?? DEFAULT_LIMIT,
      windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    });
    if (!rate.ok) {
      return jobAgentJson(
        { ok: false, error: "Too many requests", digest },
        429,
        { "Retry-After": String(rate.retryAfterSec) },
      );
    }

    const response = await handler({ uid, digest });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
    return response;
  } catch (error) {
    if (error instanceof HttpError) {
      return jobAgentJson(
        { ok: false, error: error.message, digest },
        error.status,
      );
    }
    if (error instanceof ZodError) {
      return jobAgentJson(
        { ok: false, error: conciseZodError(error), digest },
        400,
      );
    }

    console.error("job-agent-api", {
      digest,
      route: new URL(request.url).pathname,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return jobAgentJson(
      { ok: false, error: "internal_error", digest },
      500,
    );
  }
}

export function requireSafeId(value: string, label: string) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return value;
}

/** A second credential boundary for the local side-effecting browser worker. */
export function assertJobAgentWorkerRequest(request: Request) {
  const configured = process.env.JOB_AGENT_WORKER_TOKEN?.trim();
  if (!configured || configured.length < 32) {
    throw new HttpError(503, "The authenticated browser worker channel is not configured");
  }
  const supplied = request.headers.get("x-job-agent-worker-token")?.trim() ?? "";
  const configuredDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  if (!supplied || !timingSafeEqual(configuredDigest, suppliedDigest)) {
    throw new HttpError(403, "Authenticated browser worker credentials are required");
  }
}
