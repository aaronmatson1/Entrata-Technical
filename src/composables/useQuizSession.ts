import { ref, type Ref } from 'vue';
import type {
  Difficulty,
  GeneratedQuestion,
  OptionKey,
  ClassifierResult,
  RefusalResult,
} from '@/types/quiz';

// Module-level state — shared singleton across views.
// Vue Router unmounts the previous view on navigation; module state survives.

const topic = ref('');
const difficulty = ref<Difficulty>('medium');
const quizId = ref<string | null>(null);
const questions = ref<GeneratedQuestion[]>([]);
const sourceUrl = ref<string | null>(null);
const sourceTitle = ref<string | null>(null);
const answers = ref<Record<string, OptionKey>>({});
const generatedAt = ref<number | null>(null);
const flagged = ref<Set<string>>(new Set());
const lastRefusal = ref<RefusalResult | null>(null);
const lastClassifierBlock = ref<ClassifierResult | null>(null);

function reset(): void {
  topic.value = '';
  difficulty.value = 'medium';
  quizId.value = null;
  questions.value = [];
  sourceUrl.value = null;
  sourceTitle.value = null;
  answers.value = {};
  generatedAt.value = null;
  flagged.value = new Set();
  lastRefusal.value = null;
  lastClassifierBlock.value = null;
}

function clearAnswers(): void {
  answers.value = {};
  flagged.value = new Set();
}

export function useQuizSession(): {
  topic: Ref<string>;
  difficulty: Ref<Difficulty>;
  quizId: Ref<string | null>;
  questions: Ref<GeneratedQuestion[]>;
  sourceUrl: Ref<string | null>;
  sourceTitle: Ref<string | null>;
  answers: Ref<Record<string, OptionKey>>;
  generatedAt: Ref<number | null>;
  flagged: Ref<Set<string>>;
  lastRefusal: Ref<RefusalResult | null>;
  lastClassifierBlock: Ref<ClassifierResult | null>;
  reset: () => void;
  clearAnswers: () => void;
} {
  return {
    topic,
    difficulty,
    quizId,
    questions,
    sourceUrl,
    sourceTitle,
    answers,
    generatedAt,
    flagged,
    lastRefusal,
    lastClassifierBlock,
    reset,
    clearAnswers,
  };
}
