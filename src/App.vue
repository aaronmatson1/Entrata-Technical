<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
import ErrorBoundary from '@/components/ErrorBoundary.vue';
</script>

<template>
  <ErrorBoundary>
    <div class="min-h-full flex flex-col">
      <header class="border-b border-ink-100 bg-white">
        <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <RouterLink to="/" class="text-lg font-semibold text-ink-900">
            AI Quiz Builder
          </RouterLink>
          <nav class="flex gap-4 text-sm">
            <RouterLink
              to="/"
              class="text-ink-600 hover:text-ink-900"
              active-class="text-ink-900 font-medium"
            >
              New Quiz
            </RouterLink>
            <RouterLink
              to="/history"
              class="text-ink-600 hover:text-ink-900"
              active-class="text-ink-900 font-medium"
            >
              History
            </RouterLink>
          </nav>
        </div>
      </header>

      <main class="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>

      <footer class="border-t border-ink-100 py-6 text-center text-xs text-ink-500">
        Built with Vue 3 + Claude. See
        <a
          href="https://github.com/"
          class="underline hover:text-ink-700"
          rel="noopener"
          >README</a
        >
        for architecture notes.
      </footer>
    </div>
  </ErrorBoundary>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
