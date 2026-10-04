import "server-only";

/**
 * Fixed-window rate limiter (docs/18 §5). **Interim, per-instance memory**: good enough for local
 * dev and a single demo instance. Replaced by the Upstash limiter (same signature) when the
 * Upstash account exists, since serverless instances don't share memory.
 */
export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (current.count >= limit) return { ok: false, remaining: 0, resetAt: current.resetAt };
  current.count += 1;
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}

/** Test helper. */
export function resetRateLimits(): void {
  windows.clear();
}
