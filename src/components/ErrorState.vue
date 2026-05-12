<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
  suggestions?: string[] | undefined;
  primaryLabel?: string | undefined;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <div role="alert" class="card border-amber-200 bg-amber-50 space-y-4">
    <h2 class="text-lg font-semibold text-ink-900">{{ title }}</h2>
    <p class="text-ink-700">{{ message }}</p>
    <div v-if="suggestions && suggestions.length > 0">
      <p class="text-sm font-medium text-ink-800 mb-2">Try one of these:</p>
      <ul class="list-disc list-inside text-sm text-ink-700 space-y-1">
        <li v-for="s in suggestions" :key="s">{{ s }}</li>
      </ul>
    </div>
    <button type="button" class="btn-primary" @click="$emit('retry')">
      {{ primaryLabel ?? 'Try a different topic' }}
    </button>
  </div>
</template>
