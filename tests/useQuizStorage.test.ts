/**
 * Tests for useQuizStorage composable.
 *
 * Covers:
 * - Happy path: saveQuiz, getQuiz, deleteQuiz, clearAll
 * - Versioned envelope: reads version:1 shape correctly
 * - Zod-validated reads: malformed JSON is discarded and localStorage is cleared
 * - Schema drift: valid JSON but wrong shape (missing fields) is discarded
 * - Wrong envelope version: treated as invalid, discarded
 * - 20-quiz cap: oldest entries are evicted when the cap is reached
 * - Duplicate saves: updating an existing quiz by id replaces in-place
 * - SSR guard: functions are no-ops when window is undefined (skipped here — jsdom always has window)
 *
 * Module-level singletons (quizzes ref, loaded flag) require a fresh module
 * import per test. We use vi.resetModules() + dynamic import inside each test.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { CompletedQuiz } from '@/types/quiz';

const STORAGE_KEY = 'quiz_history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuiz(overrides: Partial<CompletedQuiz> = {}): CompletedQuiz {
  return {
    id: 'quiz-1',
    topic: 'Photosynthesis',
    difficulty: 'medium',
    completedAt: 1_700_000_000_000,
    score: { correct: 3, total: 5 },
    questions: [
      {
        id: 'q1',
        question: 'What does photosynthesis produce?',
        options: { A: 'Oxygen', B: 'Carbon monoxide', C: 'Nitrogen', D: 'Helium' },
        correct: 'A',
        explanation: 'Photosynthesis produces oxygen as a byproduct.',
      },
    ],
    answers: { q1: 'A' },
    flagged: [],
    ...overrides,
  };
}

/**
 * Return a fresh module instance — bypasses the module-level `loaded` singleton
 * so each test starts with a clean slate.
 */
async function freshModule() {
  vi.resetModules();
  const mod = await import('@/composables/useQuizStorage');
  return mod.useQuizStorage();
}

// ---------------------------------------------------------------------------
// Setup: wipe localStorage before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// saveQuiz + getQuiz
// ---------------------------------------------------------------------------

describe('saveQuiz and getQuiz', () => {
  it('saves a quiz and retrieves it by id', async () => {
    const storage = await freshModule();
    const quiz = makeQuiz();
    storage.saveQuiz(quiz);
    expect(storage.getQuiz('quiz-1')).toEqual(quiz);
  });

  it('returns undefined for an unknown id', async () => {
    const storage = await freshModule();
    expect(storage.getQuiz('not-a-real-id')).toBeUndefined();
  });

  it('persists the quiz to localStorage as a versioned envelope', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz());
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.quizzes)).toBe(true);
    expect(parsed.quizzes).toHaveLength(1);
    expect(parsed.quizzes[0].id).toBe('quiz-1');
  });

  it('prepends new quizzes so the most recent is first', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz({ id: 'quiz-old', completedAt: 1_000 }));
    storage.saveQuiz(makeQuiz({ id: 'quiz-new', completedAt: 2_000 }));
    expect(storage.quizzes.value[0]?.id).toBe('quiz-new');
    expect(storage.quizzes.value[1]?.id).toBe('quiz-old');
  });

  it('updates an existing quiz in-place when the same id is saved again', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz({ score: { correct: 2, total: 5 } }));
    storage.saveQuiz(makeQuiz({ score: { correct: 5, total: 5 } }));
    // Still only one entry
    expect(storage.quizzes.value).toHaveLength(1);
    expect(storage.getQuiz('quiz-1')?.score.correct).toBe(5);
  });

  it('updated quiz stays at its original position in the list', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz({ id: 'quiz-a' }));
    storage.saveQuiz(makeQuiz({ id: 'quiz-b' }));
    // quiz-b is index 0, quiz-a is index 1
    storage.saveQuiz(makeQuiz({ id: 'quiz-a', topic: 'Updated Topic' }));
    expect(storage.quizzes.value[1]?.id).toBe('quiz-a');
    expect(storage.quizzes.value[1]?.topic).toBe('Updated Topic');
  });
});

// ---------------------------------------------------------------------------
// deleteQuiz
// ---------------------------------------------------------------------------

describe('deleteQuiz', () => {
  it('removes the quiz from the reactive list', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz());
    storage.deleteQuiz('quiz-1');
    expect(storage.quizzes.value).toHaveLength(0);
    expect(storage.getQuiz('quiz-1')).toBeUndefined();
  });

  it('persists the deletion to localStorage', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz());
    storage.deleteQuiz('quiz-1');
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.quizzes).toHaveLength(0);
  });

  it('is a no-op for an id that does not exist', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz());
    storage.deleteQuiz('ghost-id');
    expect(storage.quizzes.value).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe('clearAll', () => {
  it('empties the reactive list', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz({ id: 'q-1' }));
    storage.saveQuiz(makeQuiz({ id: 'q-2' }));
    storage.clearAll();
    expect(storage.quizzes.value).toHaveLength(0);
  });

  it('writes an empty envelope to localStorage', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz());
    storage.clearAll();
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.quizzes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 20-quiz cap
// ---------------------------------------------------------------------------

describe('20-quiz cap', () => {
  it('keeps at most 20 quizzes, evicting oldest', async () => {
    const storage = await freshModule();
    for (let i = 1; i <= 21; i++) {
      storage.saveQuiz(makeQuiz({ id: `quiz-${i}`, topic: `Topic ${i}` }));
    }
    expect(storage.quizzes.value).toHaveLength(20);
    // The oldest (quiz-1) should have been evicted; quiz-21 is the newest
    const ids = storage.quizzes.value.map((q) => q.id);
    expect(ids).not.toContain('quiz-1');
    expect(ids[0]).toBe('quiz-21');
  });

  it('saving exactly 20 quizzes does not evict any', async () => {
    const storage = await freshModule();
    for (let i = 1; i <= 20; i++) {
      storage.saveQuiz(makeQuiz({ id: `quiz-${i}` }));
    }
    expect(storage.quizzes.value).toHaveLength(20);
  });

  it('cap does not apply to updating an existing quiz', async () => {
    const storage = await freshModule();
    for (let i = 1; i <= 20; i++) {
      storage.saveQuiz(makeQuiz({ id: `quiz-${i}` }));
    }
    // Updating quiz-1 (already in the list) should not evict anything
    storage.saveQuiz(makeQuiz({ id: 'quiz-1', topic: 'Updated' }));
    expect(storage.quizzes.value).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// Hydration from localStorage (readEnvelope + Zod validation)
// ---------------------------------------------------------------------------

describe('hydration from localStorage', () => {
  it('loads an existing valid envelope on first access', async () => {
    const quiz = makeQuiz({ id: 'pre-existing' });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, quizzes: [quiz] }),
    );
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(1);
    expect(storage.quizzes.value[0]?.id).toBe('pre-existing');
  });

  it('returns empty list and clears storage when JSON is unparseable', async () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json {{{{');
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns empty list and clears storage when envelope version is wrong', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 99, quizzes: [] }),
    );
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('discards and clears storage when a quiz is missing required fields', async () => {
    // completedAt is missing — fails Zod schema
    const malformed = {
      version: 1,
      quizzes: [
        {
          id: 'bad-quiz',
          topic: 'Rome',
          difficulty: 'easy',
          // completedAt intentionally missing
          score: { correct: 1, total: 5 },
          questions: [],
          answers: {},
          flagged: [],
        },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(malformed));
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('discards storage when difficulty is an invalid enum value', async () => {
    const badDifficulty = {
      version: 1,
      quizzes: [
        makeQuiz({ difficulty: 'expert' as unknown as 'easy' }),
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(badDifficulty));
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('discards storage when a question has an invalid correct enum', async () => {
    const quiz = makeQuiz();
    // Corrupt the correct key on the nested question
    (quiz.questions[0] as unknown as Record<string, unknown>)['correct'] = 'E';
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, quizzes: [quiz] }),
    );
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns empty list when localStorage is empty', async () => {
    const storage = await freshModule();
    expect(storage.quizzes.value).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reactive quizzes ref
// ---------------------------------------------------------------------------

describe('reactive quizzes ref', () => {
  it('quizzes ref reflects saves without re-calling useQuizStorage', async () => {
    const storage = await freshModule();
    const initial = storage.quizzes.value.length;
    storage.saveQuiz(makeQuiz({ id: 'reactive-test' }));
    expect(storage.quizzes.value.length).toBe(initial + 1);
  });

  it('quizzes ref reflects deletes', async () => {
    const storage = await freshModule();
    storage.saveQuiz(makeQuiz({ id: 'to-delete' }));
    storage.deleteQuiz('to-delete');
    expect(storage.quizzes.value.find((q) => q.id === 'to-delete')).toBeUndefined();
  });
});
