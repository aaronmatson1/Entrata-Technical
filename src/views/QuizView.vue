<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { nanoid } from 'nanoid';
import { useQuizSession } from '@/composables/useQuizSession';
import { useQuizGenerator } from '@/composables/useQuizGenerator';
import QuizQuestion from '@/components/QuizQuestion.vue';
import SkeletonQuestion from '@/components/SkeletonQuestion.vue';
import LoadingStage from '@/components/LoadingStage.vue';
import ErrorState from '@/components/ErrorState.vue';

const router = useRouter();
const session = useQuizSession();
const { stage, generate } = useQuizGenerator();

const ready = ref(false);
const failure = ref<{ title: string; message: string; suggestions?: string[] } | null>(
  null,
);
const quizHeading = ref<HTMLElement | null>(null);

const allAnswered = computed(() =>
  session.questions.value.every((q) => session.answers.value[q.id] !== undefined),
);

onMounted(async () => {
  if (!session.topic.value || !session.difficulty.value) {
    void router.replace('/');
    return;
  }
  session.clearAnswers();
  const outcome = await generate({
    topic: session.topic.value,
    difficulty: session.difficulty.value,
  });

  if (outcome.kind === 'quiz') {
    session.quizId.value = nanoid(12);
    session.questions.value = outcome.quiz.questions;
    session.sourceTitle.value = outcome.quiz.source.title;
    session.sourceUrl.value = outcome.quiz.source.url;
    session.generatedAt.value = Date.now();
    session.lastRefusal.value = null;
    ready.value = true;
    await nextTick();
    quizHeading.value?.focus();
    return;
  }

  if (outcome.kind === 'refusal') {
    session.lastRefusal.value = {
      reason: outcome.refusal.reason,
      category: outcome.refusal.category,
    };
    failure.value = {
      title:
        outcome.refusal.category === 'harmful'
          ? "We can't quiz on this topic"
          : outcome.refusal.category === 'ungroundable'
            ? 'Not enough source material'
            : 'Topic is too ambiguous',
      message: outcome.refusal.reason,
      suggestions: ['The French Revolution', 'Photosynthesis', 'Ancient Egypt'],
    };
    return;
  }

  if (outcome.kind === 'no_wikipedia') {
    failure.value = {
      title: "Couldn't find background info on this topic",
      message:
        "We need a Wikipedia article to ground the questions, and we couldn't find one. Try a more well-known subject.",
      suggestions: ['The French Revolution', 'Photosynthesis', 'Ancient Egypt'],
    };
    return;
  }

  failure.value = {
    title: 'Something went wrong generating the quiz',
    message: outcome.message,
  };
});

function submitQuiz(): void {
  void router.push('/results');
}

function newTopic(): void {
  session.reset();
  void router.push('/');
}
</script>

<template>
  <section aria-labelledby="quiz-title" class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-wide text-ink-500 font-medium">
        Topic — {{ session.difficulty.value }}
      </p>
      <h1
        id="quiz-title"
        ref="quizHeading"
        tabindex="-1"
        class="text-2xl font-semibold text-ink-900 focus:outline-none"
      >
        {{ session.topic.value }}
      </h1>
    </header>

    <div v-if="failure">
      <ErrorState
        :title="failure.title"
        :message="failure.message"
        :suggestions="failure.suggestions"
        primary-label="Try a different topic"
        @retry="newTopic"
      />
    </div>

    <template v-else-if="!ready">
      <LoadingStage :stage="stage" />
      <div class="space-y-4">
        <SkeletonQuestion v-for="i in 5" :key="i" :index="i - 1" />
      </div>
    </template>

    <template v-else>
      <p v-if="session.sourceUrl.value" class="text-xs text-ink-500">
        Grounded in
        <a
          :href="session.sourceUrl.value"
          target="_blank"
          rel="noopener"
          class="underline hover:text-ink-800"
        >Wikipedia: {{ session.sourceTitle.value }}</a>.
      </p>
      <div class="space-y-4">
        <QuizQuestion
          v-for="(q, i) in session.questions.value"
          :key="q.id"
          :question="q"
          :index="i"
          :model-value="session.answers.value[q.id]"
          @update:model-value="(v) => (session.answers.value[q.id] = v)"
        />
      </div>
      <div class="flex justify-between items-center pt-2">
        <p class="text-sm text-ink-500">
          {{ Object.keys(session.answers.value).length }} /
          {{ session.questions.value.length }} answered
        </p>
        <button
          type="button"
          class="btn-primary"
          :disabled="!allAnswered"
          @click="submitQuiz"
        >
          Submit quiz
        </button>
      </div>
    </template>
  </section>
</template>
