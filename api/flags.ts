import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIp } from './_lib/ratelimit.js';
import { flagRequestSchema } from './_lib/schemas.js';

/**
 * Q13. POST a structured flag signal.
 * Logs to Vercel function logs in the shape a real review queue would consume.
 * Production version routes to a labeled review queue + secondary validator.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = flagRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', detail: parsed.error.flatten() });
    return;
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit('flag', ip);
  if (!rl.allowed) {
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.reset));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  console.log(
    JSON.stringify({
      type: 'quiz_flag',
      receivedAt: new Date().toISOString(),
      ...parsed.data,
    }),
  );

  res.status(202).json({ accepted: true });
}
