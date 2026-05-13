/**
 * Q2 + Q10: Sonnet generator with two-tool choice (generate_quiz | refuse_topic).
 * Q5: system prompt + tool schema are cached via cache_control ephemeral.
 * Q12: prompt builders are pure functions — snapshot-tested.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { Difficulty } from '../../../src/types/quiz.js';

export const GENERATE_QUIZ_TOOL_NAME = 'generate_quiz';
export const REFUSE_TOPIC_TOOL_NAME = 'refuse_topic';

export const GENERATE_QUIZ_TOOL: Anthropic.Tool = {
  name: GENERATE_QUIZ_TOOL_NAME,
  description:
    'Emit five high-quality multiple-choice questions grounded strictly in the provided Wikipedia context.',
  input_schema: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['id', 'question', 'options', 'correct', 'explanation'],
          properties: {
            id: {
              type: 'string',
              description: 'Short stable id like "q1", "q2", ...',
            },
            question: { type: 'string' },
            options: {
              type: 'object',
              required: ['A', 'B', 'C', 'D'],
              properties: {
                A: { type: 'string' },
                B: { type: 'string' },
                C: { type: 'string' },
                D: { type: 'string' },
              },
            },
            correct: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            explanation: {
              type: 'string',
              description:
                'One or two sentences explaining why the correct answer is correct, grounded in the source context.',
            },
          },
        },
      },
    },
  },
};

export const REFUSE_TOPIC_TOOL: Anthropic.Tool = {
  name: REFUSE_TOPIC_TOOL_NAME,
  description:
    'Refuse to generate a quiz when the topic is harmful, cannot be grounded in the provided context, or is too ambiguous to produce unambiguous questions. Use this instead of generate_quiz when refusing.',
  input_schema: {
    type: 'object',
    required: ['reason', 'category'],
    properties: {
      reason: { type: 'string' },
      category: {
        type: 'string',
        enum: ['harmful', 'ungroundable', 'ambiguous'],
      },
    },
  },
};

const DIFFICULTY_RUBRIC: Record<Difficulty, string> = {
  easy: `EASY — definitional and recognition questions.
Pattern: "What is X?" / "Which term describes X?" / "X is best defined as ___"
Distractors are clearly wrong on a careful reading. A reader who has read the context once should score 5/5.`,

  medium: `MEDIUM — application and comprehension.
Pattern: "Which of the following is an example of X?" / "X best explains which of these outcomes?"
Distractors are plausible to a casual reader but a careful reader can eliminate them.`,

  hard: `HARD — synthesis and nuance.
Pattern: requires connecting two or more facts from the context, or distinguishing between fine-grained variants.
Distractors are themselves true statements that are not the best answer to the question asked. Avoid trick questions or trivia; reward careful reading.`,
};

export const GENERATOR_SYSTEM = `You are an expert quiz writer producing high-quality multiple-choice questions for an educational quiz tool.

CORE RULES — these never bend:
1. Every question MUST have exactly ONE unambiguously correct answer (A/B/C/D).
2. Avoid questions where two or more options could be defensibly correct.
3. Do NOT introduce facts that are not supported by the provided Wikipedia context. If a fact isn't in the context, don't quiz on it.
4. Avoid opinion-based, context-dependent, or debatable questions (no "Who is the greatest...", no "Which is more important...").
5. Distractors must be plausible but clearly wrong on careful reading.
6. Write explanations in direct, confident language. State facts directly — do NOT use meta-references to the source like "According to the article", "The article states", "As mentioned in the context", or similar phrases. Only use facts from the provided context.

OUTPUT PROTOCOL:
- You have two tools available: generate_quiz and refuse_topic.
- Call generate_quiz when you can produce five high-quality, grounded questions.
- Call refuse_topic when ANY of these are true:
  * The topic or context contains harmful content that slipped through earlier filters.
  * The provided context is too thin, too tangential, or too narrow to support five distinct questions.
  * The topic is so ambiguous that you cannot produce unambiguously-correct questions.
- Choose exactly one tool. Never respond with plain text.

DIFFICULTY:
The user request specifies a difficulty level. Use ONLY the rubric for that level.

${DIFFICULTY_RUBRIC.easy}

${DIFFICULTY_RUBRIC.medium}

${DIFFICULTY_RUBRIC.hard}`;

export interface GeneratorUserMessageInput {
  topic: string;
  difficulty: Difficulty;
  context: { title: string; summary: string; url: string };
  validationFeedback?: string;
}

export function buildGeneratorMessages(input: GeneratorUserMessageInput): Array<{
  role: 'user';
  content: string;
}> {
  const feedbackBlock = input.validationFeedback
    ? `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${input.validationFeedback}\nRegenerate, correcting the issue.`
    : '';

  return [
    {
      role: 'user',
      content: `Topic: <topic>${input.topic}</topic>
Difficulty: ${input.difficulty.toUpperCase()}

GROUNDING CONTEXT (Wikipedia article: "${input.context.title}"):
"""
${input.context.summary}
"""
Source: ${input.context.url}

Produce five multiple-choice questions at the specified difficulty, grounded strictly in the context above. Use the generate_quiz tool.${feedbackBlock}`,
    },
  ];
}
