# AI Quiz Builder

[![ci](https://github.com/aaronmatson1/Entrata-Technical/actions/workflows/ci.yml/badge.svg)](https://github.com/aaronmatson1/Entrata-Technical/actions/workflows/ci.yml)

> **Live demo:** _add Vercel URL here once deployed_

---

## What this is

A topic-to-quiz generator. Enter any subject; the app grounds it in Wikipedia, asks Claude to produce five multiple-choice questions at your chosen difficulty, scores your attempt, and explains every answer.

It's an MVP, but every decision was made as if it were going to production.

---

## The through-line

> Every decision I made was about reducing the places where the model could fail — through grounding, validation, and human oversight — while being honest about where the gaps still exist and what a more robust production version would look like.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (Vue 3 + TS)                        │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │ TopicInput   │ → │  Difficulty   │ → │  Quiz / Results     │   │
│  │ (Step 1)     │    │  (Step 2)     │    │  (with flag button) │   │
│  └──────────────┘    └──────────────┘    └─────────────────────┘   │
│        │                    │                       │              │
│        ▼                    ▼                       ▼              │
│   /api/classify       /api/generate (SSE)     /api/flags           │
└────────────────────────────────────────────────────────────────────┘
             │                    │                       │
             ▼                    ▼                       ▼
    ┌─────────────────┐  ┌────────────────────┐  ┌─────────────────┐
    │ Haiku 4.5       │  │ stage: wikipedia    │  │ Vercel function  │
    │ 1 forced tool   │  │   ↓ Wikipedia REST  │  │ logs (structured │
    │ classify_topic  │  │   + opensearch      │  │ JSON for review) │
    └─────────────────┘  │   fuzzy fallback     │  └─────────────────┘
                         │ stage: generating    │
                         │   ↓ Sonnet 4.6       │
                         │   2-tool choice:     │
                         │   generate_quiz |    │
                         │   refuse_topic       │
                         │ stage: validating    │
                         │   ↓ Zod schema       │
                         │ stage: done          │
                         └────────────────────┘
                                  │
                                  ▼
                       Per-IP rate limit (Upstash)
                       Anthropic SDK retries: disabled
                       Tiered app-level retry: 1 per tier
```

### Stack

| Layer            | Choice                          | Why                                                              |
| ---------------- | ------------------------------- | ---------------------------------------------------------------- |
| Frontend         | Vue 3 + TypeScript (strict++)   | Composition API, strict-plus TS catches index-access bugs        |
| Hosting          | Vercel (SPA + serverless)       | Same repo, same deploy, key stays server-side                    |
| AI — pre-flight  | Claude Haiku 4.5                | Cheap, fast, single forced tool for the classify step            |
| AI — generation  | Claude Sonnet 4.6               | Quality where it matters; two-tool choice for real refusal       |
| Tool use         | Anthropic structured tool input | Removes JSON-parse failure as a category                         |
| Grounding        | Wikipedia REST + opensearch     | Free, no auth, fuzzy fallback for typos                          |
| Validation       | Zod at every boundary           | One pattern for schema enforcement throughout                    |
| Rate limiting    | Upstash Redis (sliding window)  | Per-IP cap on public AI endpoints; spend ceiling                 |
| State            | Module-level composables        | Smaller than Pinia for three stores; refactor seam named         |
| Routing          | Vue Router                      | Real URLs, back button, deep links to past quizzes               |
| Storage          | localStorage (versioned)        | Schema + version field; treated as a real data store             |
| Styling          | Tailwind CSS                    | Custom palette, not default Tailwind look                        |

---

## Decisions and reasoning

The decisions below are why this project exists in the shape it does. Each section is the decision, why it was the right call, and what was given up. The full set of 22 decisions (including build-foundation choices, accessibility floor, env management, and others) lives in [`decisions.md`](./decisions.md).

### 1. Model selection: split Haiku 4.5 (classifier) + Sonnet 4.6 (generator)

Pre-flight classification is a small, structured judgement that runs on every submit. Question generation is a quality-sensitive, amortized call that runs once per accepted topic. Matching model tier to task keeps the cost/latency floor low without paying Sonnet rates on rejection traffic.

**Tradeoff:** two model versions to track in the Anthropic dashboard. Worth it for the clarity of separation.

**Production extension:** ambiguous or high-stakes topics could escalate to Opus 4.7 with a longer-form chain-of-reasoning prompt.

### 2. Two-tool choice for the generator — defense in depth as mechanism, not prose

The generator endpoint gives Claude two tools and forces it to call exactly one: `generate_quiz` for normal output, `refuse_topic` for content the model judges harmful, ungroundable, or too ambiguous. The classifier upstream is one layer of safety; the system prompt is another; the two-tool choice is the third — implemented as an actual mechanism the model can invoke, not just a clause in the system prompt asking it to refuse.

**Tradeoff:** slightly more complex prompt and response parsing than a single forced tool. The honesty of the refusal mechanism is worth it.

### 3. Wikipedia server-side with fuzzy fallback, fail closed if no article

Wikipedia is fetched inside `/api/generate` before the Sonnet call, with a Wikipedia opensearch fuzzy fallback that catches typos ("Eifel Tower" → "Eiffel Tower"). If neither direct nor fuzzy fetch finds an article, the generator does **not** run — the user gets a "couldn't find background info" message with suggested topics, and that's it.

This preserves the RAG thesis: grounding is the accuracy guarantee. Ungrounded generation undermines it. Hallucination prevention is the feature.

**Tradeoff:** rejects some legitimate topics that have no Wikipedia article. A production version would fall back to Britannica or a curated topic library — never to ungrounded generation.

### 4. Prompt caching on the static system block

The generator's system prompt + difficulty rubric + tool schema is the same for every request. It's marked `cache_control: { type: "ephemeral" }`. The Wikipedia summary and the topic stay uncached because they're per-request.

Repeat generations within the cache window hit the static prefix at ~10% the input cost. Classifier prompts are too short to clear the cache minimum and aren't cached.

**Production extension:** per-topic Wikipedia summaries with a longer TTL when the same topic recurs.

### 5. Tiered retry — failure mode determines response

Tool use eliminates JSON-parse failure as a class. Three failure modes survive, each handled differently:

| Failure                                     | Retry behavior                                                  |
| ------------------------------------------- | --------------------------------------------------------------- |
| Transient API error (429, 5xx, timeout)     | One retry with backoff                                          |
| Tool output valid shape but failed Zod      | One retry, validation error fed back in the next prompt         |
| Model used no tool (refusal-style)          | No retry — surfaces as a clean refusal in the UI                |

Anthropic's SDK-level retries are **disabled** (`maxRetries: 0`). Stacking blind SDK retries on top of typed app-level retries hides timing from the user and the logs.

### 6. Where AI does and doesn't do work

Scoring is a pure function that never touches Claude. Answer comparison, score arithmetic, and per-question pass/fail are deterministic — same input, same output, every time, testable without a stub. The LLM handles writing questions and explanations; everything around it is plain code.

### 7. Pre-flight classifier as a separate, single-responsibility prompt

Classification (viable + appropriate + intent) is a different job from generation. Splitting it into a separate prompt (and a separate, cheaper model) means each prompt has one responsibility and can be updated, tested, or replaced independently.

### 8. Defense in depth on content safety — three named layers

1. **Client-side validation.** Length floor and ceiling, empty-input button disabled. No API call until this passes.
2. **Pre-flight classifier.** Haiku checks viability and appropriateness, returns structured JSON. Rejection messaging distinguishes "not quizzable" from "not appropriate (careless language)" from "not appropriate (deliberate intent)".
3. **Generator refusal tool.** Even after the classifier passes, Sonnet has `refuse_topic` available — it can decline to generate when the topic or context contains harmful content the classifier missed.

No single layer is relied upon alone. Each is independently testable.

---

## Production considerations

Five places where the MVP captures the right signal locally and a production version routes it to durable infrastructure. The pattern is the same across all five.

- **localStorage → real datastore.** Quiz history is in a versioned envelope (`{ version: 1, quizzes: [] }`) with Zod-validated reads. The migration to a backend is a swap inside one composable, not a rewrite.
- **Streaming tool-use input → per-card render.** Loading is currently staged via SSE (wikipedia → generating → validating → done) with skeleton cards. A production version would stream the tool-use JSON input deltas and render each question card as it completes parsing, dropping perceived latency to <1s.
- **Vercel function logs → Sentry / Datadog.** `/api/errors` accepts structured error reports from the client (`{ message, stack, route, userAgent }`) and writes to function logs as JSON. Production swaps the destination, not the contract.
- **Upstash rate limit → + Cloudflare Turnstile.** Per-IP rate limit is the actual cost ceiling. A production version layers in Turnstile (or hCaptcha) for bot-class abuse beyond what IP rate-limiting catches.
- **Flag endpoint → labeled review queue.** `/api/flags` captures `{ quizId, questionId, category, topic, generatedAt }` as structured JSON in the shape a real review queue would consume. Production routes those flags to a labeled training set, a secondary validator, or a human reviewer.

---

## What I'd build next

- **Streaming render** — tool-use input deltas, parse partial JSON, render each question as it lands. Biggest perceived-quality lift available.
- **Per-topic Wikipedia cache with longer TTL** — same-topic re-generations would be near-instant.
- **End-to-end test harness with a stubbed Anthropic client** — covers the happy path + each retry tier without paying per run.

---

## Setup (local)

```bash
git clone https://github.com/aaronmatson1/Entrata-Technical.git
cd Entrata-Technical
cp .env.example .env
# fill in:
#   ANTHROPIC_API_KEY
#   UPSTASH_REDIS_REST_URL          (optional locally — pass-through if missing)
#   UPSTASH_REDIS_REST_TOKEN        (optional locally)
npm install
npm run dev    # vite dev server on :5173, proxies /api to vercel dev on :3000
```

For full local API behavior, run `vercel dev` in a second terminal — it serves the `/api/*` functions on :3000 which the Vite proxy targets.

```bash
npm run typecheck   # vue-tsc, no emit
npm test            # vitest
npm run build       # production build
```

### Required env vars

| Var                            | Where                | Purpose                                   |
| ------------------------------ | -------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY`            | Vercel + local       | Server-only. Never prefix with `VITE_`.   |
| `UPSTASH_REDIS_REST_URL`       | Vercel + local       | Per-IP rate limit                         |
| `UPSTASH_REDIS_REST_TOKEN`     | Vercel + local       | Per-IP rate limit                         |
| `ANTHROPIC_MODEL_CLASSIFIER`   | Optional             | Defaults to `claude-haiku-4-5-20251001`   |
| `ANTHROPIC_MODEL_GENERATOR`    | Optional             | Defaults to `claude-sonnet-4-6`           |

---

## Tech stack

Vue 3 · TypeScript · Vite · Vue Router · Tailwind CSS · Zod · @anthropic-ai/sdk · @upstash/ratelimit · nanoid · Vitest · Vercel Serverless · GitHub Actions

---

## Reading the project

- [`plan.md`](./plan.md) — the original plan written before any code
- [`decisions.md`](./decisions.md) — 22 decisions resolved during a structured interview before the build started
- `api/` — serverless functions (classify, generate, flags, errors)
- `api/_lib/prompts/` — classifier and generator prompts; locked by snapshot tests in `tests/prompts.test.ts`
- `src/composables/` — `useQuizSession`, `useClassifier`, `useQuizGenerator`, `useQuizStorage`, `useScoring`
- `src/views/` — `HomeView`, `QuizView`, `ResultsView`, `HistoryView`, `HistoryDetailView`
