<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { useRouter } from 'vue-router';

const error = ref<Error | null>(null);
const router = useRouter();
const isDev = import.meta.env.DEV;

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  return false;
});

function reset(): void {
  error.value = null;
  void router.push('/');
}
</script>

<template>
  <div v-if="error" role="alert" class="max-w-xl mx-auto px-6 py-16">
    <div class="card border-red-200">
      <h1 class="text-xl font-semibold text-ink-900 mb-2">Something went wrong</h1>
      <p class="text-ink-600 mb-6">
        An unexpected error happened. We've logged it. You can reset and try again.
      </p>
      <p v-if="isDev" class="text-xs font-mono text-ink-500 mb-6 break-words">
        {{ error.message }}
      </p>
      <button class="btn-primary" @click="reset">Reset</button>
    </div>
  </div>
  <slot v-else />
</template>
