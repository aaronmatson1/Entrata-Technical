import { ref, type Ref } from 'vue';
import { z } from 'zod';
import type { CompletedQuiz, QuizHistoryEnvelope } from '@/types/quiz';

const STORAGE_KEY = 'quiz_history';
const MAX_ENTRIES = 20;

const optionKeyEnum = z.enum(['A', 'B', 'C', 'D']);
const difficultyEnum = z.enum(['easy', 'medium', 'hard']);

const completedQuizSchema: z.ZodType<CompletedQuiz> = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  difficulty: difficultyEnum,
  completedAt: z.number().int(),
  score: z.object({ correct: z.number().int().min(0), total: z.number().int().min(0) }),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      question: z.string().min(1),
      options: z.object({
        A: z.string().min(1),
        B: z.string().min(1),
        C: z.string().min(1),
        D: z.string().min(1),
      }),
      correct: optionKeyEnum,
      explanation: z.string().min(1),
    }),
  ),
  answers: z.record(z.string(), optionKeyEnum),
  flagged: z.array(z.string()),
});

const envelopeSchema = z.object({
  version: z.literal(1),
  quizzes: z.array(completedQuizSchema),
});

const quizzes = ref<CompletedQuiz[]>([]);
let loaded = false;

function readEnvelope(): QuizHistoryEnvelope {
  if (typeof window === 'undefined') return { version: 1, quizzes: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { version: 1, quizzes: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = envelopeSchema.safeParse(parsed);
    if (!result.success) {
      // Shape drift — discard cleanly. Production would migrate by version.
      window.localStorage.removeItem(STORAGE_KEY);
      return { version: 1, quizzes: [] };
    }
    return result.data;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { version: 1, quizzes: [] };
  }
}

function writeEnvelope(env: QuizHistoryEnvelope): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
  } catch {
    // Quota exceeded or storage disabled — degrade silently.
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  quizzes.value = readEnvelope().quizzes;
  loaded = true;
}

function saveQuiz(quiz: CompletedQuiz): void {
  ensureLoaded();
  const existingIdx = quizzes.value.findIndex((q) => q.id === quiz.id);
  if (existingIdx >= 0) {
    quizzes.value = [
      ...quizzes.value.slice(0, existingIdx),
      quiz,
      ...quizzes.value.slice(existingIdx + 1),
    ];
  } else {
    quizzes.value = [quiz, ...quizzes.value].slice(0, MAX_ENTRIES);
  }
  writeEnvelope({ version: 1, quizzes: quizzes.value });
}

function getQuiz(id: string): CompletedQuiz | undefined {
  ensureLoaded();
  return quizzes.value.find((q) => q.id === id);
}

function deleteQuiz(id: string): void {
  ensureLoaded();
  quizzes.value = quizzes.value.filter((q) => q.id !== id);
  writeEnvelope({ version: 1, quizzes: quizzes.value });
}

function clearAll(): void {
  quizzes.value = [];
  writeEnvelope({ version: 1, quizzes: [] });
}

export function useQuizStorage(): {
  quizzes: Ref<CompletedQuiz[]>;
  saveQuiz: (quiz: CompletedQuiz) => void;
  getQuiz: (id: string) => CompletedQuiz | undefined;
  deleteQuiz: (id: string) => void;
  clearAll: () => void;
} {
  ensureLoaded();
  return {
    quizzes,
    saveQuiz,
    getQuiz,
    deleteQuiz,
    clearAll,
  };
}
