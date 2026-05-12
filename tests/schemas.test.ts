import { describe, it, expect } from 'vitest';
import {
  classifyRequestSchema,
  generateRequestSchema,
  generateQuizToolInputSchema,
  classifierToolInputSchema,
  refuseTopicToolInputSchema,
  flagRequestSchema,
} from '../api/_lib/schemas';

describe('classifyRequestSchema', () => {
  it('accepts a normal topic', () => {
    expect(classifyRequestSchema.safeParse({ topic: 'photosynthesis' }).success).toBe(true);
  });

  it('rejects topic shorter than 3 chars', () => {
    expect(classifyRequestSchema.safeParse({ topic: 'ab' }).success).toBe(false);
  });

  it('rejects topic longer than 100 chars', () => {
    expect(classifyRequestSchema.safeParse({ topic: 'x'.repeat(101) }).success).toBe(false);
  });

  it('trims whitespace before validating length', () => {
    expect(classifyRequestSchema.safeParse({ topic: '   ab   ' }).success).toBe(false);
    expect(classifyRequestSchema.safeParse({ topic: '   abc   ' }).success).toBe(true);
  });

  it('rejects missing topic', () => {
    expect(classifyRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('generateRequestSchema', () => {
  it('accepts valid topic and difficulty', () => {
    expect(
      generateRequestSchema.safeParse({ topic: 'rome', difficulty: 'medium' }).success,
    ).toBe(true);
  });

  it('rejects unknown difficulty', () => {
    expect(
      generateRequestSchema.safeParse({ topic: 'rome', difficulty: 'expert' }).success,
    ).toBe(false);
  });
});

describe('classifierToolInputSchema', () => {
  it('accepts the documented shape', () => {
    const ok = {
      viable: true,
      appropriate: true,
      intent: 'legitimate' as const,
      reason: '',
    };
    expect(classifierToolInputSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects unknown intent values', () => {
    const bad = { viable: true, appropriate: true, intent: 'maybe', reason: '' };
    expect(classifierToolInputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('generateQuizToolInputSchema', () => {
  function makeQ(id: string) {
    return {
      id,
      question: 'What is X?',
      options: { A: 'a', B: 'b', C: 'c', D: 'd' },
      correct: 'A',
      explanation: 'because the article says so',
    };
  }

  it('requires exactly five questions', () => {
    const four = { questions: [makeQ('1'), makeQ('2'), makeQ('3'), makeQ('4')] };
    const six = {
      questions: [
        makeQ('1'),
        makeQ('2'),
        makeQ('3'),
        makeQ('4'),
        makeQ('5'),
        makeQ('6'),
      ],
    };
    const five = {
      questions: [makeQ('1'), makeQ('2'), makeQ('3'), makeQ('4'), makeQ('5')],
    };
    expect(generateQuizToolInputSchema.safeParse(four).success).toBe(false);
    expect(generateQuizToolInputSchema.safeParse(six).success).toBe(false);
    expect(generateQuizToolInputSchema.safeParse(five).success).toBe(true);
  });

  it('rejects invalid correct enum (catches "E" bug at API boundary)', () => {
    const q = { ...makeQ('1'), correct: 'E' };
    const payload = { questions: [q, makeQ('2'), makeQ('3'), makeQ('4'), makeQ('5')] };
    expect(generateQuizToolInputSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing options keys', () => {
    const q = { ...makeQ('1'), options: { A: 'a', B: 'b', C: 'c' } };
    const payload = { questions: [q, makeQ('2'), makeQ('3'), makeQ('4'), makeQ('5')] };
    expect(generateQuizToolInputSchema.safeParse(payload).success).toBe(false);
  });
});

describe('refuseTopicToolInputSchema', () => {
  it('accepts known categories', () => {
    for (const category of ['harmful', 'ungroundable', 'ambiguous'] as const) {
      expect(
        refuseTopicToolInputSchema.safeParse({ reason: 'x', category }).success,
      ).toBe(true);
    }
  });

  it('rejects unknown category', () => {
    expect(
      refuseTopicToolInputSchema.safeParse({ reason: 'x', category: 'other' }).success,
    ).toBe(false);
  });
});

describe('flagRequestSchema', () => {
  it('accepts a complete flag payload', () => {
    const ok = {
      quizId: 'abc123',
      questionId: 'q1',
      topic: 'rome',
      category: 'inaccurate' as const,
      generatedAt: Date.now(),
    };
    expect(flagRequestSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects unknown flag category', () => {
    const bad = {
      quizId: 'abc123',
      questionId: 'q1',
      topic: 'rome',
      category: 'rude',
      generatedAt: Date.now(),
    };
    expect(flagRequestSchema.safeParse(bad).success).toBe(false);
  });
});
