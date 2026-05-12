<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useQuizStorage } from '@/composables/useQuizStorage';
import QuizResults from '@/components/QuizResults.vue';

const props = defineProps<{ id: string }>();

const router = useRouter();
const { getQuiz, deleteQuiz } = useQuizStorage();
const heading = ref<HTMLElement | null>(null);

const quiz = computed(() => getQuiz(props.id));
const flaggedSet = computed(() => new Set(quiz.value?.flagged ?? []));
const perQuestion = computed(() => {
  if (!quiz.value) return [];
  return quiz.value.questions.map((q) => ({
    id: q.id,
    correct: quiz.value!.answers[q.id] === q.correct,
  }));
});

onMounted(async () => {
  await nextTick();
  heading.value?.focus();
});

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function confirmDelete(): void {
  if (!quiz.value) return;
  if (
    window.confirm(
      `Delete this quiz on "${quiz.value.topic}" from history? Cannot be undone.`,
    )
  ) {
    deleteQuiz(quiz.value.id);
    void router.push('/history');
  }
}
</script>

<template>
  <section v-if="!quiz" aria-labelledby="missing-title" class="card text-center space-y-3">
    <h1 id="missing-title" class="text-2xl font-semibold text-ink-900">
      Quiz not found
    </h1>
    <p class="text-ink-600">
      This quiz isn't in this browser's history. It may have been cleared or
      taken on a different device.
    </p>
    <RouterLink to="/history" class="btn-primary inline-block">Back to history</RouterLink>
  </section>

  <section v-else aria-labelledby="detail-title" class="space-y-6">
    <header
      ref="heading"
      tabindex="-1"
      class="card text-center space-y-2 focus:outline-none"
    >
      <p class="text-xs uppercase tracking-wide text-ink-500 font-medium">
        Past quiz — {{ formatDate(quiz.completedAt) }}
      </p>
      <p id="detail-title" class="text-5xl font-bold text-ink-900">
        {{ quiz.score.correct }} / {{ quiz.score.total }}
      </p>
      <p class="text-sm text-ink-600">
        on <span class="font-medium">{{ quiz.topic }}</span> ({{ quiz.difficulty }})
      </p>
    </header>

    <QuizResults
      :questions="quiz.questions"
      :answers="quiz.answers"
      :flagged="flaggedSet"
      :per-question="perQuestion"
      :quiz-id="quiz.id"
      :topic="quiz.topic"
      :generated-at="quiz.completedAt"
    />

    <div class="flex justify-between pt-2">
      <RouterLink to="/history" class="btn-secondary">Back to history</RouterLink>
      <button type="button" class="text-sm text-red-600 hover:underline" @click="confirmDelete">
        Delete this quiz
      </button>
    </div>
  </section>
</template>
