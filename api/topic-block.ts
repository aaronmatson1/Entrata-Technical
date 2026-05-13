import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIp } from './_lib/ratelimit.js';
import { topicBlockSchema } from './_lib/schemas.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = topicBlockSchema.safeParse(req.body);
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
      type: 'topic_block',
      receivedAt: new Date().toISOString(),
      ...parsed.data,
    }),
  );

  res.status(202).json({ accepted: true });
}
