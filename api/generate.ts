import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAnthropic } from './_lib/anthropic.js';
import { env } from './_lib/env.js';
import { checkRateLimit, getClientIp } from './_lib/ratelimit.js';
import {
  generateRequestSchema,
  generateQuizToolInputSchema,
  refuseTopicToolInputSchema,
} from './_lib/schemas.js';
import { getWikipediaContext, WikipediaNotFoundError } from './_lib/wikipedia.js';
import { openSSE } from './_lib/sse.js';
import {
  GENERATE_QUIZ_TOOL,
  GENERATE_QUIZ_TOOL_NAME,
  REFUSE_TOPIC_TOOL,
  REFUSE_TOPIC_TOOL_NAME,
  GENERATOR_SYSTEM,
  buildGeneratorMessages,
} from './_lib/prompts/generator.js';

const GENERATOR_TIMEOUT_MS = 45000;
const MAX_TOKENS = 8192;

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = generateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', detail: parsed.error.flatten() });
    return;
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit('generate', ip);
  if (!rl.allowed) {
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(rl.reset));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const { topic, difficulty } = parsed.data;
  const stream = openSSE(res);

  try {
    // Stage 1: Wikipedia
    stream.send({ stage: 'wikipedia' });
    let context;
    try {
      context = await getWikipediaContext(topic);
    } catch (err) {
      if (err instanceof WikipediaNotFoundError) {
        stream.send({
          stage: 'error',
          error: 'no_wikipedia_article',
        });
        stream.close();
        return;
      }
      throw err;
    }

    // Stage 2: generate
    stream.send({ stage: 'generating' });
    const generated = await runGenerator({ topic, difficulty, context });

    // Stage 3: validate
    stream.send({ stage: 'validating' });

    if (generated.kind === 'refusal') {
      stream.send({
        stage: 'done',
        payload: { type: 'refusal', ...generated.value },
      });
      stream.close();
      return;
    }

    stream.send({
      stage: 'done',
      payload: {
        type: 'quiz',
        topic,
        difficulty,
        source: { title: context.title, url: context.url },
        questions: generated.value.questions,
      },
    });
    stream.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    try {
      stream.send({ stage: 'error', error: message });
    } catch {
      // SSE write may fail if connection dropped
    }
    stream.close();
  }
}

type GeneratorOutcome =
  | { kind: 'quiz'; value: { questions: unknown[] } & Record<string, unknown> }
  | { kind: 'refusal'; value: { reason: string; category: 'harmful' | 'ungroundable' | 'ambiguous' } };

async function runGenerator(input: {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context: { title: string; summary: string; url: string };
}): Promise<GeneratorOutcome> {
  // Q6 tier (3): one retry on transient API errors.
  // Q6 tier (2): one retry on schema validation failure with feedback fed back.
  // Q6 tier (1): tool missing entirely → treat as refusal, no retry.

  let firstAttempt;
  try {
    firstAttempt = await callGenerator(input, undefined);
  } catch (err) {
    if (isTransient(err)) {
      await sleep(800);
      firstAttempt = await callGenerator(input, undefined);
    } else {
      throw err;
    }
  }

  if (firstAttempt.kind === 'refusal') return firstAttempt;
  if (firstAttempt.kind === 'no_tool') {
    return {
      kind: 'refusal',
      value: {
        reason: 'The model declined to generate questions for this topic.',
        category: 'ambiguous',
      },
    };
  }

  if (firstAttempt.kind === 'quiz') return firstAttempt;

  // firstAttempt.kind === 'invalid' → tier (2) retry with feedback
  const secondAttempt = await callGenerator(input, firstAttempt.feedback);
  if (secondAttempt.kind === 'refusal') return secondAttempt;
  if (secondAttempt.kind === 'quiz') return secondAttempt;
  if (secondAttempt.kind === 'no_tool') {
    return {
      kind: 'refusal',
      value: {
        reason: 'The model declined to generate questions after a retry.',
        category: 'ambiguous',
      },
    };
  }
  // Still invalid after retry — surface as refusal so user sees a clean state.
  return {
    kind: 'refusal',
    value: {
      reason: 'The model produced malformed output and could not self-correct.',
      category: 'ambiguous',
    },
  };
}

type GeneratorAttempt =
  | { kind: 'quiz'; value: { questions: unknown[] } & Record<string, unknown> }
  | { kind: 'refusal'; value: { reason: string; category: 'harmful' | 'ungroundable' | 'ambiguous' } }
  | { kind: 'no_tool' }
  | { kind: 'invalid'; feedback: string };

async function callGenerator(
  input: {
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    context: { title: string; summary: string; url: string };
  },
  validationFeedback: string | undefined,
): Promise<GeneratorAttempt> {
  const client = getAnthropic();
  const response = await client.messages.create(
    {
      model: env.MODEL_GENERATOR,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: GENERATOR_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [GENERATE_QUIZ_TOOL, REFUSE_TOPIC_TOOL],
      tool_choice: { type: 'any' },
      messages: buildGeneratorMessages({
        ...input,
        ...(validationFeedback ? { validationFeedback } : {}),
      }),
    },
    { timeout: GENERATOR_TIMEOUT_MS },
  );

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { kind: 'no_tool' };
  }

  if (toolUse.name === REFUSE_TOPIC_TOOL_NAME) {
    const parsed = refuseTopicToolInputSchema.safeParse(toolUse.input);
    if (!parsed.success) return { kind: 'no_tool' };
    return { kind: 'refusal', value: parsed.data };
  }

  if (toolUse.name === GENERATE_QUIZ_TOOL_NAME) {
    const parsed = generateQuizToolInputSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return {
        kind: 'invalid',
        feedback: summarizeZodFailure(parsed.error.flatten()),
      };
    }
    return { kind: 'quiz', value: parsed.data };
  }

  return { kind: 'no_tool' };
}

function summarizeZodFailure(flat: { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }): string {
  const parts: string[] = [];
  if (flat.formErrors.length > 0) parts.push(...flat.formErrors);
  for (const [key, errs] of Object.entries(flat.fieldErrors)) {
    if (errs) parts.push(`${key}: ${errs.join(', ')}`);
  }
  return parts.length > 0 ? parts.join('; ') : 'output failed schema validation';
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
