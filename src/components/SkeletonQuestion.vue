<script setup lang="ts">
defineProps<{ index: number }>();
</script>

<template>
  <div class="card space-y-4 animate-pulse" aria-hidden="true">
    <div>
      <div class="h-3 w-24 bg-ink-100 rounded mb-2" />
      <div class="h-5 w-3/4 bg-ink-100 rounded" />
    </div>
    <div class="space-y-2">
      <div v-for="n in 4" :key="n" class="h-10 bg-ink-100 rounded" />
    </div>
  </div>
</template>
