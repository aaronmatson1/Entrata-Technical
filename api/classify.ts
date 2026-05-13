import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAnthropic } from './_lib/anthropic.js';
import { env } from './_lib/env.js';
import { checkRateLimit, getClientIp } from './_lib/ratelimit.js';
import { classifyRequestSchema, classifierToolInputSchema } from './_lib/schemas.js';
import {
  CLASSIFIER_SYSTEM,
  CLASSIFIER_TOOL,
  CLASSIFIER_TOOL_NAME,
  buildClassifierMessages,
} from './_lib/prompts/classifier.js';

const CLASSIFIER_TIMEOUT_MS = 15000;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = classifyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', detail: parsed.error.flatten() });
    return;
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit('classify', ip);
  if (!rl.allowed) {
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.reset));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  try {
    const result = await callClassifierWithRetry(parsed.data.topic);
    res.status(200).json(result);
  } catch (err) {
    console.error('[classify] error:', err);
    res.status(502).json({ error: 'classifier_failed' });
  }
}

async function callClassifierWithRetry(topic: string): Promise<{
  viable: boolean;
  appropriate: boolean;
  intent: 'legitimate' | 'careless' | 'deliberate' | 'unclear';
  reason: string;
}> {
  try {
    return await callClassifier(topic);
  } catch (err) {
    if (isTransient(err)) {
      await sleep(400);
      return await callClassifier(topic);
    }
    throw err;
  }
}

async function callClassifier(topic: string): Promise<{
  viable: boolean;
  appropriate: boolean;
  intent: 'legitimate' | 'careless' | 'deliberate' | 'unclear';
  reason: string;
}> {
  const client = getAnthropic();
  const response = await client.messages.create(
    {
      model: env.MODEL_CLASSIFIER,
      max_tokens: 512,
      system: CLASSIFIER_SYSTEM,
      tools: [CLASSIFIER_TOOL],
      tool_choice: { type: 'tool', name: CLASSIFIER_TOOL_NAME },
      messages: buildClassifierMessages(topic),
    },
    { timeout: CLASSIFIER_TIMEOUT_MS },
  );

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use' || toolUse.name !== CLASSIFIER_TOOL_NAME) {
    // Tier (1): tool not used. Conservative refusal — surface as not appropriate.
    return {
      viable: false,
      appropriate: false,
      intent: 'unclear',
      reason: 'Classifier did not return a structured result.',
    };
  }

  const parsed = classifierToolInputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return {
      viable: false,
      appropriate: false,
      intent: 'unclear',
      reason: 'Classifier returned malformed input.',
    };
  }
  return parsed.data;
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; name?: string };
  if (e.status === 429) return true;
  if (typeof e.status === 'number' && e.status >= 500 && e.status < 600) return true;
  if (e.name === 'APIConnectionTimeoutError') return true;
  if (e.name === 'APIConnectionError') return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
