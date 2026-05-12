<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
}>();

const MIN = 3;
const MAX = 100;

const touched = ref(false);
const local = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const trimmed = computed(() => local.value.trim());
const tooShort = computed(() => trimmed.value.length > 0 && trimmed.value.length < MIN);
const tooLong = computed(() => trimmed.value.length > MAX);
const empty = computed(() => trimmed.value.length === 0);
const invalid = computed(() => empty.value || tooShort.value || tooLong.value);

const errorMessage = computed(() => {
  if (!touched.value) return null;
  if (empty.value) return 'Enter a topic to continue.';
  if (tooShort.value) return `Topic must be at least ${MIN} characters.`;
  if (tooLong.value) return `Topic must be at most ${MAX} characters.`;
  return null;
});

function onSubmit(): void {
  touched.value = true;
  if (invalid.value) return;
  emit('submit');
}
</script>

<template>
  <form aria-labelledby="topic-label" class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label
        id="topic-label"
        for="topic-input"
        class="block text-sm font-medium text-ink-800 mb-2"
      >
        What topic should the quiz cover?
      </label>
      <input
        id="topic-input"
        v-model="local"
        type="text"
        autocomplete="off"
        :maxlength="MAX + 20"
        :disabled="disabled"
        :aria-invalid="errorMessage !== null"
        aria-describedby="topic-hint topic-error"
        placeholder="e.g. the French Revolution, photosynthesis, ancient Rome"
        class="input-field"
        @blur="touched = true"
      />
      <p id="topic-hint" class="mt-2 text-xs text-ink-500">
        Best with well-known historical, scientific, or cultural subjects.
        {{ trimmed.length }}/{{ MAX }} characters.
      </p>
      <p
        v-if="errorMessage"
        id="topic-error"
        role="alert"
        class="mt-2 text-sm text-red-600"
      >
        {{ errorMessage }}
      </p>
    </div>

    <button type="submit" class="btn-primary" :disabled="disabled || invalid">
      Continue
    </button>
  </form>
</template>
