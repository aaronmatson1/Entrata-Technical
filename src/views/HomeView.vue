<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuizSession } from '@/composables/useQuizSession';
import { useClassifier } from '@/composables/useClassifier';
import TopicInput from '@/components/TopicInput.vue';
import DifficultySelect from '@/components/DifficultySelect.vue';
import ErrorState from '@/components/ErrorState.vue';

const router = useRouter();
const session = useQuizSession();
const { classifying, error: classifierError, classify } = useClassifier();

const step = ref<'topic' | 'difficulty' | 'rejected'>('topic');
const rejection = ref<{ title: string; message: string } | null>(null);
const difficultyHeading = ref<HTMLElement | null>(null);

const EXAMPLE_SUGGESTIONS = [
  'The French Revolution',
  'Photosynthesis',
  'Ancient Egypt',
  'The Apollo missions',
];

const INTERNAL_REASONS = new Set([
  'Classifier returned malformed input.',
  'Classifier did not return a structured result.',
]);

function safeReason(reason: string, fallback: string): string {
  return reason && !INTERNAL_REASONS.has(reason) ? reason : fallback;
}

function postTopicBlock(result: { viable: boolean; appropriate: boolean; intent: 'legitimate' | 'careless' | 'deliberate' | 'unclear'; reason: string }): void {
  fetch('/api/topic-block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: session.topic.value.trim(),
      viable: result.viable,
      appropriate: result.appropriate,
      intent: result.intent,
      reason: result.reason,
      blockedAt: Date.now(),
    }),
  }).catch(() => {});
}

async function onTopicSubmit(): Promise<void> {
  rejection.value = null;
  const result = await classify(session.topic.value.trim());
  session.lastClassifierBlock.value = result;

  if (!result) return;

  if (!result.viable) {
    rejection.value = {
      title: "Can't quiz on this topic",
      message: safeReason(
        result.reason,
        "This topic doesn't have enough factual content to generate reliable questions. Try something like a historical event, scientific concept, or geographic region.",
      ),
    };
    step.value = 'rejected';
    postTopicBlock(result);
    return;
  }

  if (!result.appropriate) {
    rejection.value = {
      title:
        result.intent === 'careless'
          ? "Let's try that without the language"
          : 'This topic is off-limits',
      message:
        result.intent === 'careless'
          ? "Your topic contains language that isn't appropriate here. If you meant something legitimate, try rephrasing without the vulgar terms."
          : safeReason(
              result.reason,
              "This topic isn't something we can quiz on. Please pick a different subject.",
            ),
    };
    step.value = 'rejected';
    postTopicBlock(result);
    return;
  }

  step.value = 'difficulty';
  await nextTick();
  difficultyHeading.value?.focus();
}

function onGenerateSubmit(): void {
  void router.push('/quiz');
}

function resetToTopic(): void {
  step.value = 'topic';
  rejection.value = null;
}
</script>

<template>
  <section aria-labelledby="home-title" class="space-y-6">
    <header class="space-y-2">
      <h1 id="home-title" class="text-3xl font-semibold text-ink-900">
        Generate a quiz
      </h1>
      <p class="text-ink-600">
        Pick a topic. We'll ground it in Wikipedia and Claude will write five
        multiple-choice questions.
      </p>
    </header>

    <div class="card">
      <Transition name="fade" mode="out-in">
        <div v-if="step === 'topic'" key="topic" class="space-y-3">
          <TopicInput
            v-model="session.topic.value"
            :disabled="classifying"
            @submit="onTopicSubmit"
          />
          <p v-if="classifying" aria-live="polite" class="text-sm text-ink-500">
            Checking topic…
          </p>
          <p v-if="classifierError" role="alert" class="text-sm text-red-600">
            {{ classifierError }}
          </p>
        </div>

        <div v-else-if="step === 'difficulty'" key="difficulty" class="space-y-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-ink-500 font-medium">
              Topic
            </p>
            <h2
              ref="difficultyHeading"
              tabindex="-1"
              class="text-lg font-medium text-ink-900 focus:outline-none"
            >
              {{ session.topic.value }}
            </h2>
          </div>
          <DifficultySelect
            v-model="session.difficulty.value"
            @submit="onGenerateSubmit"
            @back="step = 'topic'"
          />
        </div>

        <div v-else key="rejected">
          <ErrorState
            v-if="rejection"
            :title="rejection.title"
            :message="rejection.message"
            :suggestions="EXAMPLE_SUGGESTIONS"
            @retry="resetToTopic"
          />
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
