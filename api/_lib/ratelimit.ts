import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env.js';
import type { VercelRequest } from '@vercel/node';

let limiterCache: Map<string, Ratelimit> | null = null;

function getRedis(): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getLimiter(key: string, capacity: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!limiterCache) limiterCache = new Map();
  let limiter = limiterCache.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(capacity, `${windowSec} s`),
      analytics: false,
      prefix: `quiz:${key}`,
    });
    limiterCache.set(key, limiter);
  }
  return limiter;
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0];
    if (first) return first.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/**
 * If Upstash not configured (local dev), pass-through with allowed=true.
 * Production deploys MUST have Upstash configured — verified via README setup.
 */
export async function checkRateLimit(
  bucket: 'classify' | 'generate' | 'flag' | 'error',
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[bucket];
  const limiter = getLimiter(bucket, config.capacity, config.windowSec);
  if (!limiter) {
    return { allowed: true, remaining: config.capacity, reset: 0 };
  }
  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

const RATE_LIMITS = {
  classify: { capacity: 30, windowSec: 3600 },
  generate: { capacity: 10, windowSec: 3600 },
  flag: { capacity: 30, windowSec: 3600 },
  error: { capacity: 60, windowSec: 3600 },
} as const;
