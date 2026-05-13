<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuizSession } from '@/composables/useQuizSession';
import { useQuizStorage } from '@/composables/useQuizStorage';
import { scoreQuiz } from '@/composables/useScoring';
import QuizResults from '@/components/QuizResults.vue';
import type { CompletedQuiz, FlagCategory } from '@/types/quiz';

const router = useRouter();
const session = useQuizSession();
const { saveQuiz } = useQuizStorage();
const scoreHeading = ref<HTMLElement | null>(null);

const result = computed(() =>
  scoreQuiz(session.questions.value, session.answers.value),
);

function buildSnapshot(): CompletedQuiz | null {
  const id = session.quizId.value;
  const generatedAt = session.generatedAt.value;
  if (!id || !generatedAt) return null;
  return {
    id,
    topic: session.topic.value,
    difficulty: session.difficulty.value,
    completedAt: Date.now(),
    score: { correct: result.value.correct, total: result.value.total },
    questions: session.questions.value,
    answers: { ...session.answers.value },
    flagged: Array.from(session.flagged.value),
  };
}

onMounted(async () => {
  if (session.questions.value.length === 0) {
    void router.replace('/');
    return;
  }
  const snapshot = buildSnapshot();
  if (snapshot) saveQuiz(snapshot);
  await nextTick();
  scoreHeading.value?.focus();
});

async function onFlag(payload: { questionId: string; category: FlagCategory }): Promise<void> {
  session.flagged.value.add(payload.questionId);
  const snapshot = buildSnapshot();
  if (snapshot) saveQuiz(snapshot);
  try {
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: session.quizId.value,
        questionId: payload.questionId,
        topic: session.topic.value,
        category: payload.category,
        generatedAt: session.generatedAt.value ?? Date.now(),
      }),
    });
  } catch {
    // fire-and-forget; flagging shouldn't fail the UX
  }
}

function quizAgain(): void {
  session.questions.value = [];
  session.clearAnswers();
  void router.push('/quiz');
}

function newTopic(): void {
  session.reset();
  void router.push('/');
}

const nextDifficulty = computed<'medium' | 'hard' | null>(() => {
  if (session.difficulty.value === 'easy') return 'medium';
  if (session.difficulty.value === 'medium') return 'hard';
  return null;
});

function tryHarder(): void {
  if (!nextDifficulty.value) return;
  session.difficulty.value = nextDifficulty.value;
  session.clearAnswers();
  void router.push('/quiz');
}
</script>

<template>
  <section aria-labelledby="results-title" class="space-y-6">
    <header
      ref="scoreHeading"
      tabindex="-1"
      class="card text-center space-y-2 focus:outline-none"
    >
      <p class="text-xs uppercase tracking-wide text-ink-500 font-medium">Your score</p>
      <p id="results-title" class="text-5xl font-bold text-ink-900">
        {{ result.correct }} / {{ result.total }}
      </p>
      <p class="text-sm text-ink-600">
        on
        <span class="font-medium">{{ session.topic.value }}</span>
        ({{ session.difficulty.value }})
      </p>
    </header>

    <QuizResults
      v-if="session.quizId.value && session.generatedAt.value"
      :questions="session.questions.value"
      :answers="session.answers.value"
      :flagged="session.flagged.value"
      :per-question="result.perQuestion"
      :quiz-id="session.quizId.value"
      :topic="session.topic.value"
      :generated-at="session.generatedAt.value"
      :source-url="session.sourceUrl.value"
      :source-title="session.sourceTitle.value"
      @flag="onFlag"
    />

    <div
      v-if="nextDifficulty"
      class="card flex items-center justify-between gap-4 bg-accent-50 border-accent-200"
    >
      <p class="text-sm text-ink-700">
        Ready for a bigger challenge? Try
        <span class="font-medium capitalize">{{ nextDifficulty }}</span>
        on the same topic.
      </p>
      <button type="button" class="btn-primary shrink-0" @click="tryHarder">
        Try {{ nextDifficulty }}
      </button>
    </div>

    <div class="flex gap-3 pt-2">
      <button type="button" class="btn-secondary" @click="quizAgain">
        Quiz again — same topic
      </button>
      <button type="button" class="btn-primary" @click="newTopic">New topic</button>
    </div>
  </section>
</template>
