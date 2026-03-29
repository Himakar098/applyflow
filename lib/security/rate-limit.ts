type RateBucket = {
  count: number;
  resetAt: number;
};

type GlobalWithRateLimiter = typeof globalThis & {
  __applyflowRateLimiter?: Map<string, RateBucket>;
};

export type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
};

function getStore() {
  const globalRef = globalThis as GlobalWithRateLimiter;
  if (!globalRef.__applyflowRateLimiter) {
    globalRef.__applyflowRateLimiter = new Map<string, RateBucket>();
  }
  return globalRef.__applyflowRateLimiter;
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first?.trim()) return first.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();

  return "unknown";
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const existing = store.get(input.key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + input.windowMs;
    store.set(input.key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: Math.max(input.limit - 1, 0),
      retryAfterSec: Math.ceil(input.windowMs / 1000),
      resetAt,
    };
  }

  const nextCount = existing.count + 1;
  existing.count = nextCount;
  store.set(input.key, existing);

  const remaining = Math.max(input.limit - nextCount, 0);
  const retryAfterSec = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);

  return {
    ok: nextCount <= input.limit,
    remaining,
    retryAfterSec,
    resetAt: existing.resetAt,
  };
}
