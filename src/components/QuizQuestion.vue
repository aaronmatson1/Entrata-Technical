<script setup lang="ts">
import { computed } from 'vue';
import type { GeneratedQuestion, OptionKey } from '@/types/quiz';

const props = defineProps<{
  question: GeneratedQuestion;
  index: number;
  modelValue: OptionKey | undefined;
  disabled?: boolean;
}>();

defineEmits<{ 'update:modelValue': [value: OptionKey] }>();

const orderedKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
const groupName = computed(() => `q-${props.question.id}`);
</script>

<template>
  <fieldset class="card space-y-4" :aria-labelledby="`${groupName}-label`" :disabled="disabled">
    <div :id="`${groupName}-label`">
      <span class="text-xs font-medium uppercase tracking-wide text-ink-500"
        >Question {{ index + 1 }}</span
      >
      <p class="text-lg font-medium text-ink-900 mt-1">{{ question.question }}</p>
    </div>
    <div class="space-y-2">
      <label
        v-for="key in orderedKeys"
        :key="key"
        class="flex items-start gap-3 p-3 rounded-md border border-ink-200 bg-white cursor-pointer hover:border-ink-300 has-[:checked]:border-accent-500 has-[:checked]:bg-accent-50 has-[:disabled]:opacity-60 has-[:disabled]:cursor-not-allowed"
      >
        <input
          type="radio"
          :name="groupName"
          :value="key"
          :checked="modelValue === key"
          :disabled="disabled"
          class="mt-1 accent-accent-600"
          @change="$emit('update:modelValue', key)"
        />
        <span class="flex-1 text-ink-800">
          <span class="font-semibold text-ink-900 mr-2">{{ key }}.</span>
          {{ question.options[key] }}
        </span>
      </label>
    </div>
  </fieldset>
</template>
