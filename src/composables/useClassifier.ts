import { ref, type Ref } from 'vue';
import type { ClassifierResult } from '@/types/quiz';

export function useClassifier(): {
  classifying: Ref<boolean>;
  error: Ref<string | null>;
  classify: (topic: string) => Promise<ClassifierResult | null>;
} {
  const classifying = ref(false);
  const error = ref<string | null>(null);

  async function classify(topic: string): Promise<ClassifierResult | null> {
    classifying.value = true;
    error.value = null;
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (res.status === 429) {
        error.value = "You're sending requests too quickly. Wait a minute and try again.";
        return null;
      }
      if (!res.ok) {
        error.value = "Couldn't check this topic right now. Please try again.";
        return null;
      }
      const data = (await res.json()) as ClassifierResult;
      return data;
    } catch {
      error.value = 'Network error. Check your connection and try again.';
      return null;
    } finally {
      classifying.value = false;
    }
  }

  return { classifying, error, classify };
}
