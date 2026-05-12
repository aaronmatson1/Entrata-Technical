import type { GeneratedQuestion, OptionKey } from '@/types/quiz';

/**
 * Q6 + Q12: scoring is deterministic — never touches the LLM.
 * Pure function so it can be unit-tested without setup.
 */
export function scoreQuiz(
  questions: GeneratedQuestion[],
  answers: Record<string, OptionKey>,
): { correct: number; total: number; perQuestion: Array<{ id: string; correct: boolean }> } {
  let correct = 0;
  const perQuestion: Array<{ id: string; correct: boolean }> = [];
  for (const q of questions) {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.correct;
    if (isCorrect) correct++;
    perQuestion.push({ id: q.id, correct: isCorrect });
  }
  return { correct, total: questions.length, perQuestion };
}
