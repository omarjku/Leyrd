// Tiny in-memory fixed-window limiter. Good enough for a single instance;
// swap for Redis/Postgres if the app is scaled horizontally.
const MAX_KEYS = 20_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (b) buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Evict oldest entries (Map keeps insertion order) instead of scanning.
    while (buckets.size > MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/**
 * Client IP as seen by our hosting proxy. Clients can prepend arbitrary
 * X-Forwarded-For entries, so only the last hop (appended by the platform
 * proxy) is trusted.
 */
export function clientIpFromHeaders(h: Headers | undefined | null): string {
  const parts = (h?.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.at(-1) ?? "unknown";
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}
