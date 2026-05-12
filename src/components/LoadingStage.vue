<script setup lang="ts">
import { computed } from 'vue';
import type { GenerateStage } from '@/types/quiz';

const props = defineProps<{ stage: GenerateStage | 'idle' }>();

const STAGE_COPY: Record<GenerateStage | 'idle', { label: string; description: string }> = {
  idle: { label: 'Preparing…', description: '' },
  wikipedia: {
    label: 'Reading Wikipedia',
    description: 'Fetching background context to ground the questions.',
  },
  generating: {
    label: 'Generating questions',
    description: 'Claude is writing five questions from the source material.',
  },
  validating: {
    label: 'Validating',
    description: 'Checking that the output is well-formed.',
  },
  done: { label: 'Done', description: '' },
  error: { label: 'Something went wrong', description: '' },
};

const current = computed(() => STAGE_COPY[props.stage]);

const stages: Array<{ key: GenerateStage; label: string }> = [
  { key: 'wikipedia', label: 'Wikipedia' },
  { key: 'generating', label: 'Generating' },
  { key: 'validating', label: 'Validating' },
];

function indexOfStage(s: GenerateStage | 'idle'): number {
  if (s === 'wikipedia') return 0;
  if (s === 'generating') return 1;
  if (s === 'validating') return 2;
  if (s === 'done') return 3;
  return -1;
}
const stageIndex = computed(() => indexOfStage(props.stage));
</script>

<template>
  <div aria-live="polite" class="space-y-3">
    <div class="flex items-center gap-3">
      <div class="relative h-5 w-5">
        <span
          class="absolute inset-0 rounded-full border-2 border-accent-200 border-t-accent-600 animate-spin"
        />
      </div>
      <span class="text-sm font-medium text-ink-900">{{ current.label }}</span>
    </div>
    <p v-if="current.description" class="text-sm text-ink-600 pl-8">
      {{ current.description }}
    </p>
    <ol class="flex gap-2 pl-8 pt-1">
      <li
        v-for="(s, i) in stages"
        :key="s.key"
        class="text-xs px-2 py-0.5 rounded-full border"
        :class="
          stageIndex > i
            ? 'border-accent-500 bg-accent-50 text-accent-700'
            : stageIndex === i
              ? 'border-accent-500 bg-white text-accent-700 font-medium'
              : 'border-ink-200 bg-white text-ink-500'
        "
      >
        {{ s.label }}
      </li>
    </ol>
  </div>
</template>
