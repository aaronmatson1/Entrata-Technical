import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIp } from './_lib/ratelimit.js';
import { errorReportSchema } from './_lib/schemas.js';

/**
 * Q17. POST client-side error report.
 * Mirrors the flag-endpoint pattern: capture the structured signal locally,
 * production routes to Sentry/Datadog. Same rhetorical pattern across the
 * codebase keeps the README's "MVP does X / production does Y" through-line
 * recognizable.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = errorReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit('error', ip);
  if (!rl.allowed) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  console.error(
    JSON.stringify({
      type: 'client_error',
      receivedAt: new Date().toISOString(),
      ...parsed.data,
    }),
  );

  res.status(202).json({ accepted: true });
}
