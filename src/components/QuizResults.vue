<script setup lang="ts">
import { ref } from 'vue';
import type { FlagCategory, GeneratedQuestion, OptionKey } from '@/types/quiz';
import FlagModal from './FlagModal.vue';

defineProps<{
  questions: GeneratedQuestion[];
  answers: Record<string, OptionKey>;
  flagged: Set<string>;
  perQuestion: Array<{ id: string; correct: boolean }>;
  quizId: string;
  topic: string;
  generatedAt: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
}>();

const emit = defineEmits<{
  flag: [{ questionId: string; category: FlagCategory }];
}>();

const flaggingId = ref<string | null>(null);

function openFlag(id: string): void {
  flaggingId.value = id;
}

function submitFlag(category: FlagCategory): void {
  if (!flaggingId.value) return;
  emit('flag', { questionId: flaggingId.value, category });
  flaggingId.value = null;
}
</script>

<template>
  <div class="space-y-6">
    <article
      v-for="(q, i) in questions"
      :key="q.id"
      class="card space-y-4"
      :class="
        perQuestion[i]?.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      "
    >
      <header>
        <span class="text-xs font-medium uppercase tracking-wide text-ink-500">
          Question {{ i + 1 }}
          —
          <span
            :class="perQuestion[i]?.correct ? 'text-green-700' : 'text-red-700'"
          >{{ perQuestion[i]?.correct ? 'Correct' : 'Incorrect' }}</span>
        </span>
        <p class="text-lg font-medium text-ink-900 mt-1">{{ q.question }}</p>
      </header>

      <ul class="space-y-1.5 text-sm">
        <li
          v-for="key in (['A', 'B', 'C', 'D'] as const)"
          :key="key"
          class="flex items-start gap-2 p-2 rounded"
          :class="{
            'bg-green-100': key === q.correct,
            'bg-red-100': answers[q.id] === key && key !== q.correct,
          }"
        >
          <span class="font-semibold w-5">{{ key }}.</span>
          <span class="flex-1">{{ q.options[key] }}</span>
          <span v-if="key === q.correct" class="text-green-700 text-xs font-medium">
            correct answer
          </span>
          <span
            v-else-if="answers[q.id] === key"
            class="text-red-700 text-xs font-medium"
          >
            your answer
          </span>
        </li>
      </ul>

      <div class="bg-white/60 rounded p-3 text-sm text-ink-800">
        <p class="font-medium text-ink-900 mb-1">Why:</p>
        <p>{{ q.explanation }}</p>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="text-xs text-ink-500 hover:text-ink-800 underline"
          :class="{ 'text-amber-700 font-medium': flagged.has(q.id) }"
          :disabled="flagged.has(q.id)"
          @click="openFlag(q.id)"
        >
          {{ flagged.has(q.id) ? 'Flagged' : 'Flag this question' }}
        </button>
      </div>
    </article>

    <p v-if="sourceUrl" class="text-xs text-ink-500 pt-2">
      Source:
      <a
        :href="sourceUrl"
        target="_blank"
        rel="noopener"
        class="underline hover:text-ink-800"
      >Wikipedia — {{ sourceTitle ?? 'article' }}</a>
    </p>

    <FlagModal
      v-if="flaggingId"
      :question-id="flaggingId"
      @cancel="flaggingId = null"
      @submit="submitFlag"
    />
  </div>
</template>
