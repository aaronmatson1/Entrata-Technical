<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useQuizStorage } from '@/composables/useQuizStorage';

const { quizzes, clearAll } = useQuizStorage();

const sorted = computed(() =>
  [...quizzes.value].sort((a, b) => b.completedAt - a.completedAt),
);

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function confirmClearAll(): void {
  if (
    window.confirm(
      'Delete all quiz history? This removes everything from this browser. Cannot be undone.',
    )
  ) {
    clearAll();
  }
}
</script>

<template>
  <section aria-labelledby="history-title" class="space-y-6">
    <header class="flex items-end justify-between">
      <div>
        <h1 id="history-title" class="text-3xl font-semibold text-ink-900">
          Quiz history
        </h1>
        <p class="text-ink-600">
          Past quizzes from this browser. Stored locally — nothing leaves the device.
        </p>
      </div>
      <button
        v-if="sorted.length > 0"
        type="button"
        class="text-sm text-ink-500 hover:text-red-600 underline"
        @click="confirmClearAll"
      >
        Clear all
      </button>
    </header>

    <div v-if="sorted.length === 0" class="card text-center text-ink-500">
      No quizzes yet.
      <RouterLink to="/" class="underline text-accent-700 hover:text-accent-800">
        Take one
      </RouterLink>.
    </div>

    <ul v-else class="space-y-3">
      <li v-for="quiz in sorted" :key="quiz.id">
        <RouterLink
          :to="`/history/${quiz.id}`"
          class="card block hover:border-accent-300 transition-colors"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink-900 truncate">{{ quiz.topic }}</p>
              <p class="text-xs text-ink-500">
                {{ quiz.difficulty }} • {{ formatDate(quiz.completedAt) }}
                <span v-if="quiz.flagged.length > 0" class="ml-2 text-amber-700">
                  {{ quiz.flagged.length }} flagged
                </span>
              </p>
            </div>
            <span class="text-lg font-semibold text-ink-900 shrink-0">
              {{ quiz.score.correct }} / {{ quiz.score.total }}
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
