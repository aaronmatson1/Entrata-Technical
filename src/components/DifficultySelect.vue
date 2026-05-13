<script setup lang="ts">
import { ref } from 'vue';
import type { Difficulty } from '@/types/quiz';

const props = defineProps<{ modelValue: Difficulty; disabled?: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: Difficulty];
  submit: [];
  back: [];
}>();

const tiers: Array<{ value: Difficulty; label: string; description: string }> = [
  { value: 'easy', label: 'Easy', description: 'Definitional. One careful read gets you 5/5.' },
  { value: 'medium', label: 'Medium', description: 'Application. Distractors plausible to a casual reader.' },
  { value: 'hard', label: 'Hard', description: 'Synthesis. Requires connecting facts.' },
];

const buttonRefs = ref<Record<Difficulty, HTMLButtonElement | null>>({
  easy: null,
  medium: null,
  hard: null,
});

function pick(value: Difficulty): void {
  if (props.disabled) return;
  emit('update:modelValue', value);
}

function onKeydown(e: KeyboardEvent, current: Difficulty): void {
  if (props.disabled) return;
  const idx = tiers.findIndex((t) => t.value === current);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = tiers[(idx + 1) % tiers.length]!;
    pick(next.value);
    buttonRefs.value[next.value]?.focus();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = tiers[(idx - 1 + tiers.length) % tiers.length]!;
    pick(prev.value);
    buttonRefs.value[prev.value]?.focus();
  }
}
</script>

<template>
  <form
    role="radiogroup"
    aria-labelledby="difficulty-label"
    class="space-y-6"
    @submit.prevent="$emit('submit')"
  >
    <div>
      <p id="difficulty-label" class="text-sm font-medium text-ink-800 mb-3">
        Pick a difficulty
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          v-for="tier in tiers"
          :key="tier.value"
          :ref="(el) => { buttonRefs[tier.value] = el as HTMLButtonElement | null }"
          type="button"
          role="radio"
          :aria-checked="modelValue === tier.value"
          :tabindex="modelValue === tier.value ? 0 : -1"
          :disabled="disabled"
          class="text-left p-4 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            modelValue === tier.value
              ? 'border-accent-500 bg-accent-50 ring-1 ring-accent-500'
              : 'border-ink-200 bg-white hover:border-ink-300'
          "
          @click="pick(tier.value)"
          @keydown="onKeydown($event, tier.value)"
        >
          <span class="block font-medium text-ink-900">{{ tier.label }}</span>
          <span class="block text-xs text-ink-500 mt-1">{{ tier.description }}</span>
        </button>
      </div>
    </div>

    <div class="flex gap-3">
      <button type="button" class="btn-secondary" :disabled="disabled" @click="$emit('back')">
        Back
      </button>
      <button type="submit" class="btn-primary" :disabled="disabled">Generate quiz</button>
    </div>
  </form>
</template>
