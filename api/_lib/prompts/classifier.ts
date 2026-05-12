/**
 * Q2 + Q10: Haiku classifier with single forced tool.
 * Q12: prompt is pure function — snapshot-tested.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const CLASSIFIER_TOOL_NAME = 'classify_topic';

export const CLASSIFIER_TOOL: Anthropic.Tool = {
  name: CLASSIFIER_TOOL_NAME,
  description:
    "Classify a quiz topic for viability (is it a real, quizzable factual subject?) and appropriateness (free of harmful, explicit, or vulgar content?). You MUST use this tool to respond.",
  input_schema: {
    type: 'object',
    required: ['viable', 'appropriate', 'intent', 'reason'],
    properties: {
      viable: {
        type: 'boolean',
        description:
          'True if the topic is a real subject with enough factual content (history, science, geography, culture, etc.) to generate five distinct multiple-choice questions. False for nonsense, single random words, or topics with no factual substance.',
      },
      appropriate: {
        type: 'boolean',
        description:
          'True if free of harmful, explicit, vulgar, or offensive content. False if it contains slurs, sexual content, instructions for violence/illegal activity, or hate speech.',
      },
      intent: {
        type: 'string',
        enum: ['legitimate', 'careless', 'deliberate', 'unclear'],
        description:
          'Inferred intent: legitimate (clear good-faith topic), careless (vulgar language without clear malicious intent), deliberate (intentionally provocative or harmful), or unclear.',
      },
      reason: {
        type: 'string',
        description:
          'Plain-language explanation if viable or appropriate is false. Empty string if both are true.',
      },
    },
  },
};

export const CLASSIFIER_SYSTEM = `You are a topic safety and viability classifier for an educational quiz generator.

Your job: decide whether a user-submitted topic should proceed to question generation.

Two independent dimensions:

1. VIABLE — is this a real, quizzable factual subject?
   - Yes: "The French Revolution", "photosynthesis", "the history of jazz", "ancient Egypt"
   - No: "asdf", "purple elephants on motorcycles", a single letter, random characters
   - No: "my dog's birthday", personal subjective topics with no public factual content

2. APPROPRIATE — is the topic itself, and the language used to describe it, free of harm?
   - Inappropriate: slurs, sexual content, instructions for violence or illegal activity, hate speech
   - Inappropriate: vulgar language directed at people or groups
   - Appropriate: historical wars, diseases, controversial figures discussed neutrally — these are educational

Edge cases:
- A topic that is appropriate-in-principle but written with vulgar language → mark appropriate=false, set intent appropriately (careless vs deliberate)
- Politically charged but legitimate topics (e.g. "the Civil War", "World War 2") → appropriate=true
- Topics that are real but extremely niche/personal with no Wikipedia presence → still viable=true; let the grounding step handle the missing-article case

Always respond by calling the classify_topic tool. Never respond with plain text.`;

export function buildClassifierMessages(topic: string): Array<{ role: 'user'; content: string }> {
  return [
    {
      role: 'user',
      content: `Classify this topic for a 5-question multiple-choice quiz:\n\n${topic}`,
    },
  ];
}
