import { describe, it, expect } from 'vitest';
import { scoreQuiz } from '@/composables/useScoring';
import type { GeneratedQuestion, OptionKey } from '@/types/quiz';

function makeQuestion(id: string, correct: OptionKey): GeneratedQuestion {
  return {
    id,
    question: `Question ${id}?`,
    options: { A: 'A', B: 'B', C: 'C', D: 'D' },
    correct,
    explanation: 'because',
  };
}

describe('scoreQuiz', () => {
  it('returns 0/5 when no answers given', () => {
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) =>
      makeQuestion(id, 'A'),
    );
    const result = scoreQuiz(questions, {});
    expect(result.correct).toBe(0);
    expect(result.total).toBe(5);
    expect(result.perQuestion).toHaveLength(5);
    expect(result.perQuestion.every((p) => !p.correct)).toBe(true);
  });

  it('returns 5/5 when all correct', () => {
    const questions = [
      makeQuestion('q1', 'A'),
      makeQuestion('q2', 'B'),
      makeQuestion('q3', 'C'),
      makeQuestion('q4', 'D'),
      makeQuestion('q5', 'A'),
    ];
    const answers: Record<string, OptionKey> = {
      q1: 'A',
      q2: 'B',
      q3: 'C',
      q4: 'D',
      q5: 'A',
    };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(5);
    expect(result.perQuestion.every((p) => p.correct)).toBe(true);
  });

  it('returns partial score with per-question detail', () => {
    const questions = [
      makeQuestion('q1', 'A'),
      makeQuestion('q2', 'B'),
      makeQuestion('q3', 'C'),
    ];
    const answers: Record<string, OptionKey> = { q1: 'A', q2: 'D', q3: 'C' };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(3);
    expect(result.perQuestion).toEqual([
      { id: 'q1', correct: true },
      { id: 'q2', correct: false },
      { id: 'q3', correct: true },
    ]);
  });

  it('treats missing answer as incorrect, never throws', () => {
    const questions = [makeQuestion('q1', 'A'), makeQuestion('q2', 'B')];
    const answers: Record<string, OptionKey> = { q1: 'A' };
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(1);
    expect(result.perQuestion[1]).toEqual({ id: 'q2', correct: false });
  });

  it('does not credit case-insensitive or whitespace variants', () => {
    const questions = [makeQuestion('q1', 'A')];
    // OptionKey is enum at type level, but defensive check at runtime
    const answers = { q1: 'a' } as unknown as Record<string, OptionKey>;
    const result = scoreQuiz(questions, answers);
    expect(result.correct).toBe(0);
  });
});
