import { ref, type Ref } from 'vue';
import type {
  Difficulty,
  GeneratedQuestion,
  GenerateStage,
  RefusalResult,
} from '@/types/quiz';

interface QuizPayload {
  type: 'quiz';
  topic: string;
  difficulty: Difficulty;
  source: { title: string; url: string };
  questions: GeneratedQuestion[];
}

interface RefusalPayload {
  type: 'refusal';
  reason: string;
  category: RefusalResult['category'];
}

export type GeneratorOutcome =
  | { kind: 'quiz'; quiz: QuizPayload }
  | { kind: 'refusal'; refusal: RefusalPayload }
  | { kind: 'no_wikipedia' }
  | { kind: 'error'; message: string };

export function useQuizGenerator(): {
  stage: Ref<GenerateStage | 'idle'>;
  generate: (input: { topic: string; difficulty: Difficulty }) => Promise<GeneratorOutcome>;
  abort: () => void;
} {
  const stage = ref<GenerateStage | 'idle'>('idle');
  let controller: AbortController | null = null;

  function abort(): void {
    controller?.abort();
    controller = null;
  }

  async function generate(input: {
    topic: string;
    difficulty: Difficulty;
  }): Promise<GeneratorOutcome> {
    abort();
    controller = new AbortController();
    stage.value = 'wikipedia';
    try {
      return await streamGeneration(input, stage, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        stage.value = 'idle';
        return { kind: 'error', message: 'Aborted' };
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      stage.value = 'error';
      return { kind: 'error', message };
    } finally {
      controller = null;
    }
  }

  return { stage, generate, abort };
}

async function streamGeneration(
  input: { topic: string; difficulty: Difficulty },
  stage: Ref<GenerateStage | 'idle'>,
  signal: AbortSignal,
): Promise<GeneratorOutcome> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(input),
    signal,
  });

  if (res.status === 429) {
    return { kind: 'error', message: "You're generating quizzes too quickly. Wait an hour and try again." };
  }
  if (!res.body) {
    return { kind: 'error', message: 'No response stream available.' };
  }
  if (!res.ok) {
    return { kind: 'error', message: `Server returned ${res.status}` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GeneratorOutcome | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const block of events) {
      const dataLine = block
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      const json = dataLine.slice(6).trim();
      if (!json) continue;
      try {
        const event = JSON.parse(json) as {
          stage: GenerateStage;
          payload?: QuizPayload | RefusalPayload;
          error?: string;
        };
        stage.value = event.stage;

        if (event.stage === 'done' && event.payload) {
          if (event.payload.type === 'quiz') {
            result = { kind: 'quiz', quiz: event.payload };
          } else {
            result = { kind: 'refusal', refusal: event.payload };
          }
        }
        if (event.stage === 'error') {
          if (event.error === 'no_wikipedia_article') {
            result = { kind: 'no_wikipedia' };
          } else {
            result = { kind: 'error', message: event.error ?? 'Server error' };
          }
        }
      } catch {
        // Drop malformed event line; keep reading.
      }
    }
  }

  return result ?? { kind: 'error', message: 'Stream ended without result.' };
}
