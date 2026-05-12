<script setup lang="ts">
defineProps<{ id: string }>();
</script>

<template>
  <section aria-labelledby="history-detail-title" class="space-y-6">
    <h1 id="history-detail-title" class="text-2xl font-semibold text-ink-900">
      Past quiz
    </h1>
    <div class="card">
      <p class="text-ink-500 text-sm">Quiz {{ id }} — Phase 5.</p>
    </div>
  </section>
</template>
