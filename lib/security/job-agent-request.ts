import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { HttpError } from "@/lib/http-error";

const DEFAULT_JSON_LIMIT = 512 * 1024;

function normalizedOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new HttpError(403, "Cross-site request rejected");
  }

  const origin = normalizedOrigin(request.headers.get("origin"));
  if (!origin) return;

  const configured = normalizedOrigin(
    process.env.JOB_AGENT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  );
  const requestOrigin = normalizedOrigin(request.url);
  const allowed = new Set([configured, requestOrigin].filter(Boolean));
  if (!allowed.has(origin)) {
    throw new HttpError(403, "Request origin is not allowed");
  }
}

export async function readLimitedJson<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_JSON_LIMIT,
): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function ipv4Number(ip: string) {
  const octets = ip.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return null;
  return (
    ((octets[0] << 24) >>> 0) +
    (octets[1] << 16) +
    (octets[2] << 8) +
    octets[3]
  ) >>> 0;
}

function ipv4InRange(address: number, base: string, prefix: number) {
  const baseNumber = ipv4Number(base);
  if (baseNumber === null) return true;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (baseNumber & mask);
}

const NON_PUBLIC_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPublicIpv4(ip: string) {
  const address = ipv4Number(ip);
  return address !== null && !NON_PUBLIC_IPV4_RANGES.some(
    ([base, prefix]) => ipv4InRange(address, base, prefix),
  );
}

function ipv6Parts(ip: string) {
  const withoutZone = ip.split("%")[0].toLowerCase();
  const doubleColonIndex = withoutZone.indexOf("::");
  if (doubleColonIndex !== -1 && withoutZone.indexOf("::", doubleColonIndex + 1) !== -1) {
    return null;
  }

  let normalized = withoutZone;
  const dottedMatch = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMatch) {
    const embedded = ipv4Number(dottedMatch[1]);
    if (embedded === null) return null;
    const replacement = `${((embedded >>> 16) & 0xffff).toString(16)}:${(embedded & 0xffff).toString(16)}`;
    normalized = normalized.slice(0, -dottedMatch[1].length) + replacement;
  }

  const [leftText, rightText = ""] = normalized.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((normalized.includes("::") && missing < 1) || (!normalized.includes("::") && missing !== 0)) {
    return null;
  }
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[a-f0-9]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function ipv6InRange(address: number[], base: string, prefix: number) {
  const baseParts = ipv6Parts(base);
  if (baseParts === null) return true;
  const wholeParts = Math.floor(prefix / 16);
  for (let index = 0; index < wholeParts; index += 1) {
    if (address[index] !== baseParts[index]) return false;
  }
  const remainingBits = prefix % 16;
  if (remainingBits === 0) return true;
  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return (address[wholeParts] & mask) === (baseParts[wholeParts] & mask);
}

function isPublicIpv6(ip: string) {
  const address = ipv6Parts(ip);
  if (address === null) return false;

  // Global unicast is currently allocated from 2000::/3. A conservative
  // allow-list also rejects IPv4-mapped, NAT64, local, multicast and link-local
  // forms without relying on their textual representation.
  if (!ipv6InRange(address, "2000::", 3)) return false;
  return ![
    ["2001::", 32],
    ["2001:2::", 48],
    ["2001:10::", 28],
    ["2001:20::", 28],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
  ].some(([base, prefix]) => ipv6InRange(address, String(base), Number(prefix)));
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

async function resolvePublicHttpTarget(value: string | URL) {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value);
  } catch {
    throw new HttpError(400, "A valid job URL is required");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError(400, "Only HTTP and HTTPS job URLs are supported");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "Credential-bearing URLs are not supported");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new HttpError(400, "Local URLs cannot be imported");
  }

  const resolved = await dnsLookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!resolved.length || resolved.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new HttpError(400, "The job URL does not resolve to a public address");
  }

  return { url, resolved };
}

export async function assertPublicHttpUrl(value: string) {
  return (await resolvePublicHttpTarget(value)).url;
}

export type PublicHttpResponse = {
  status: number;
  headers: Headers;
  body: Buffer;
};

export async function requestPublicHttpUrl(
  value: string | URL,
  options: {
    maxBytes: number;
    timeoutMs: number;
    headers?: Record<string, string>;
  },
): Promise<PublicHttpResponse> {
  const { url, resolved } = await resolvePublicHttpTarget(value);
  const pinned = resolved[0];
  const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
    if (lookupOptions.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const signal = AbortSignal.timeout(options.timeoutMs);
    const outgoing = request(url, {
      method: "GET",
      headers: options.headers,
      lookup: pinnedLookup,
      signal,
    }, (incoming) => {
      const status = incoming.statusCode ?? 0;
      const headers = new Headers();
      for (const [name, rawValue] of Object.entries(incoming.headers)) {
        if (Array.isArray(rawValue)) rawValue.forEach((item) => headers.append(name, item));
        else if (rawValue !== undefined) headers.set(name, rawValue);
      }

      const declared = Number(headers.get("content-length") ?? 0);
      if (Number.isFinite(declared) && declared > options.maxBytes) {
        incoming.resume();
        reject(new HttpError(413, "The job page is too large to import safely"));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      let complete = false;
      incoming.on("data", (chunk: Buffer | string) => {
        if (complete) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > options.maxBytes) {
          complete = true;
          incoming.destroy();
          reject(new HttpError(413, "The job page is too large to import safely"));
          return;
        }
        chunks.push(buffer);
      });
      incoming.on("end", () => {
        if (complete) return;
        complete = true;
        resolve({ status, headers, body: Buffer.concat(chunks) });
      });
      incoming.on("error", (error) => {
        if (complete) return;
        complete = true;
        reject(error);
      });
    });
    outgoing.on("error", (error) => reject(error));
    outgoing.end();
  });
}
