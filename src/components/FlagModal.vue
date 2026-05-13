<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import type { FlagCategory } from '@/types/quiz';

defineProps<{ questionId: string }>();
const emit = defineEmits<{
  cancel: [];
  submit: [category: FlagCategory];
}>();

const selected = ref<FlagCategory>('inaccurate');
const choices: Array<{ value: FlagCategory; label: string; hint: string }> = [
  { value: 'inaccurate', label: 'Inaccurate', hint: 'The correct answer is wrong.' },
  { value: 'ambiguous', label: 'Ambiguous', hint: 'Two or more answers could be correct.' },
  { value: 'poorly_worded', label: 'Poorly worded', hint: 'The question is confusing or unclear.' },
  { value: 'other', label: 'Other', hint: 'Something else is wrong with it.' },
];

const dialogRef = ref<HTMLElement | null>(null);

function getFocusable(): HTMLElement[] {
  if (!dialogRef.value) return [];
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>('input, button:not([disabled])'),
  );
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    emit('cancel');
    return;
  }
  if (e.key === 'Tab') {
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  const first = document.getElementById('flag-modal-first');
  first?.focus();
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="flag-title"
    class="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 px-4"
    @click.self="$emit('cancel')"
  >
    <div ref="dialogRef" class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
      <h2 id="flag-title" class="text-lg font-semibold text-ink-900">
        Flag this question
      </h2>
      <p class="text-sm text-ink-600">
        What's wrong? Your feedback is logged so similar questions can be improved.
      </p>

      <fieldset class="space-y-2">
        <label
          v-for="(choice, idx) in choices"
          :key="choice.value"
          class="flex items-start gap-3 p-3 rounded-md border border-ink-200 cursor-pointer hover:border-ink-300 has-[:checked]:border-accent-500 has-[:checked]:bg-accent-50"
        >
          <input
            :id="idx === 0 ? 'flag-modal-first' : undefined"
            v-model="selected"
            type="radio"
            name="flag-category"
            :value="choice.value"
            class="mt-1 accent-accent-600"
          />
          <span class="flex-1">
            <span class="block font-medium text-ink-900">{{ choice.label }}</span>
            <span class="block text-xs text-ink-500">{{ choice.hint }}</span>
          </span>
        </label>
      </fieldset>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn-secondary" @click="$emit('cancel')">
          Cancel
        </button>
        <button type="button" class="btn-primary" @click="$emit('submit', selected)">
          Submit flag
        </button>
      </div>
    </div>
  </div>
</template>
