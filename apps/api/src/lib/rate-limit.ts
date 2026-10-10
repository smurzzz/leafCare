/**
 * In-memory sliding-window rate limiter.
 *
 * docs/security.md asks for ~20 identify calls per hour per user to protect the
 * Plant.id spend. Serverless instances are ephemeral, so this is a cheap first
 * line of defence; swap the store for Redis when the API scales out.
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

const prune = (bucket: Bucket, windowMs: number, now: number): void => {
  bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export const rateLimit = (options: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult => {
  const { key, limit, windowMs } = options;
  const now = options.now ?? Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  prune(bucket, windowMs, now);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
};

/** Used by tests and the seed script. */
export const resetRateLimits = (): void => buckets.clear();
