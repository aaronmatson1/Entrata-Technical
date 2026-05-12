import { describe, it, expect } from 'vitest';
import {
  CLASSIFIER_SYSTEM,
  CLASSIFIER_TOOL,
  buildClassifierMessages,
} from '../api/_lib/prompts/classifier';
import {
  GENERATOR_SYSTEM,
  GENERATE_QUIZ_TOOL,
  REFUSE_TOPIC_TOOL,
  buildGeneratorMessages,
} from '../api/_lib/prompts/generator';

/**
 * Q12: prompt snapshot tests.
 * Lock prompts as versioned artifacts. Any unintentional change to
 * a prompt fails CI — treats prompts as code, not strings.
 *
 * Update intentionally with: pnpm vitest run -u  (or npx vitest run -u)
 */

describe('classifier prompt', () => {
  it('system prompt is stable', () => {
    expect(CLASSIFIER_SYSTEM).toMatchSnapshot();
  });

  it('tool schema is stable', () => {
    expect(CLASSIFIER_TOOL).toMatchSnapshot();
  });

  it('user message has expected shape', () => {
    expect(buildClassifierMessages('photosynthesis')).toMatchSnapshot();
  });
});

describe('generator prompt', () => {
  it('system prompt is stable', () => {
    expect(GENERATOR_SYSTEM).toMatchSnapshot();
  });

  it('generate_quiz tool schema is stable', () => {
    expect(GENERATE_QUIZ_TOOL).toMatchSnapshot();
  });

  it('refuse_topic tool schema is stable', () => {
    expect(REFUSE_TOPIC_TOOL).toMatchSnapshot();
  });

  it('user message for easy difficulty is stable', () => {
    const messages = buildGeneratorMessages({
      topic: 'photosynthesis',
      difficulty: 'easy',
      context: {
        title: 'Photosynthesis',
        summary:
          'Photosynthesis is a biological process used by plants and some other organisms to convert light energy into chemical energy.',
        url: 'https://en.wikipedia.org/wiki/Photosynthesis',
      },
    });
    expect(messages).toMatchSnapshot();
  });

  it('user message with validation feedback appended', () => {
    const messages = buildGeneratorMessages({
      topic: 'photosynthesis',
      difficulty: 'medium',
      context: {
        title: 'Photosynthesis',
        summary: 'Short summary text.',
        url: 'https://en.wikipedia.org/wiki/Photosynthesis',
      },
      validationFeedback: 'questions: must contain exactly 5 items',
    });
    expect(messages).toMatchSnapshot();
  });
});
