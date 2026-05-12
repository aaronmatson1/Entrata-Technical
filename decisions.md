# AI Quiz Builder — Decision Log

Decisions reached during grill-me interview. Source of truth for presentation prep and build.

Each entry: **Decision** / **Reasoning** / **Tradeoff** / **Presentation note**.

---

## 1. Anthropic SDK runs server-side on Vercel Serverless Functions

**Decision:** Vue app on Vercel, with `/api/*` serverless routes proxying Claude calls. `ANTHROPIC_API_KEY` stays server-side. Two routes: `/api/classify`, `/api/generate`. Plus `/api/flags`, `/api/errors` added by later decisions.

**Reasoning:** Putting the Anthropic SDK in the browser leaks the API key. Vercel serverless is the lowest-friction backend that fits the same deploy as the Vue frontend — no extra infra, one repo, one deploy.

**Tradeoff:** Plan's `src/prompts/` and `src/composables/useClassifier.ts` change shape — composables become `fetch('/api/*')` callers, prompts live in `/api/` not `/src/prompts/`.

**Presentation note:** "The Anthropic SDK never touches the client bundle. The API key lives in one place and the client only knows my endpoints."

---

## 2. Split models: Haiku 4.5 classifier + Sonnet 4.6 generator (both with tool use)

**Decision:** Classifier uses `claude-haiku-4-5-20251001`. Generator uses `claude-sonnet-4-6`. Both calls use Anthropic tool use, not free-form JSON.

**Reasoning:** Matches model tier to task. Classifier is fast/cheap/JSON-only — Haiku is correct. Generator quality matters and is amortized over one call per accepted topic — Sonnet is correct. Opus 4.7 would be overkill on a constrained Wikipedia-grounded task.

**Tradeoff:** Two model versions to keep tracked, two cost lines in Anthropic dashboard. Worth it.

**Presentation note:** "I didn't reach for the biggest hammer. I matched model tier to task — Haiku 4.5 for the pre-flight check, Sonnet 4.6 for generation. Opus 4.7 is what a production version would escalate to for ambiguous topics."

---

## 3. Wikipedia fetch happens server-side inside `/api/generate`

**Decision:** Wikipedia REST API call lives in `/api/generate`, runs before the generator Claude call. Summary never crosses the wire to browser.

**Reasoning:** One client round-trip. Server can truncate/sanitize before prompt injection. Wikipedia content is user-influenced via topic choice — sanitization is the prompt injection defense seam. Server-side caching opportunity if same topic re-quizzed.

**Tradeoff:** Client can't show distinct "fetching Wikipedia…" vs "generating questions…" loading states by default. Resolved by Q14 (SSE staged loading).

**Presentation note:** Doubles as the demonstration of the RAG pattern — the "Reading Wikipedia" stage in the loading UI is the user-visible proof that grounding happens.

---

## 4. Rate limiting: Upstash Redis per-IP + Anthropic spend cap; Turnstile named in README

**Decision:** Upstash sliding-window rate limit (~10 generations/hour per IP) on `/api/classify` and `/api/generate`. Hard spend cap in Anthropic console. Cloudflare Turnstile mentioned in README as the next layer, not built.

**Reasoning:** Public Vercel URL = anyone can burn credits in a loop. In-memory rate limit doesn't work in stateless serverless. Upstash free tier covers it with ~15 lines + 2 env vars. Turnstile alone doesn't stop a determined script — rate limit is the actual cost ceiling. Spend cap is belt #3.

**Tradeoff:** Adds Upstash account + 2 env vars to setup. Worth it for an actual cost ceiling on a public endpoint.

**Presentation note:** "Public AI endpoints are unpriced DDOS vectors. I rate-limited per IP and capped spend at the provider. Turnstile is named as the next layer for bot-class abuse."

---

## 5. Prompt caching: generator system block + tool schema only

**Decision:** `cache_control: { type: "ephemeral" }` on the generator's static system prompt + tool schema block. Wikipedia summary + topic stay uncached (per-request). Classifier prompt too small to cache effectively — skipped.

**Reasoning:** Static system prompt + tool schema is the big static thing. Cache hit on this block cuts input tokens ~90%, ~10x cheaper, lower latency. Caching per-topic Wikipedia context not worth the complexity for MVP — repeat-same-topic hit rate is low.

**Tradeoff:** Must verify generator system prompt + tool schema clears the 1024-token Sonnet cache minimum. Easy to measure with one test request.

**Presentation note:** "Cached the static system prompt — repeat generations hit ~90% input token discount. Production would extend caching to per-topic Wikipedia context with longer TTL."

---

## 6. Tiered retry: 1 retry per tier, by failure mode (not blanket)

**Decision:** Three failure modes post-tool-use:
- (1) Tool call missing entirely (refusal/guardrail) → **no retry**, surface as rejection state.
- (2) Tool call shape valid but semantics wrong (`correct: "E"`, wrong question count, dup options, empty explanation) → **1 retry** with validation error fed back to model.
- (3) Anthropic API error (429, 5xx, timeout) → **1 retry** with exponential backoff.

**Reasoning:** Tool use removes JSON-parse failure entirely. Remaining failures have different correct responses — blanket retry burns tokens on legit refusals. "Retry with validation feedback" is a real pattern; model often self-corrects. 1 retry caps worst-case latency at ~2x generator call.

**Tradeoff:** More code than blanket retry. Worth it for typed failure semantics and bounded latency.

**Presentation note:** "Tool use removes JSON-parse failure as a category. Remaining failures are semantic — I retry once with the validation error fed back, otherwise surface honestly."

---

## 7. Wikipedia 404: fuzzy opensearch fallback → fail closed if no article

**Decision:** If direct Wikipedia article fetch fails, hit Wikipedia opensearch API for fuzzy match. If top suggestion meets a score threshold, use it. If still nothing, reject the topic with a friendly message + example suggestions. **No ungrounded generation.**

**Reasoning:** Fuzzy fallback handles common typos (classifier passes "Eifel Tower" → opensearch suggests "Eiffel Tower"). Failing closed preserves the RAG thesis — grounding IS the accuracy guarantee. Ungrounded fallback would undermine the whole story.

**Tradeoff:** Rejects legitimate topics that genuinely have no Wikipedia article. Acceptable for MVP. Production: fall back to other knowledge sources (Britannica, curated topic library).

**Presentation note:** "I chose to fail closed rather than ungrounded. It preserves the integrity of the RAG pattern. Hallucination prevention is the feature."

---

## 8. localStorage: versioned envelope with Zod validation on load

**Decision:** Single key `quiz_history`. Value shape:

```ts
{
  version: 1,
  quizzes: [{
    id: string,
    topic: string,
    difficulty: 'easy' | 'medium' | 'hard',
    completedAt: number,
    score: { correct: number, total: number },
    questions: GeneratedQuestion[],
    answers: Record<string, 'A'|'B'|'C'|'D'>,
    flagged: string[]
  }]
}
```

Cap last 20 quizzes, prune oldest on insert. Zod schema validates on read; shape drift discards gracefully.

**Reasoning:** Versioning lets a v2 ship with a migration. Even if never used, naming `version: 1` shows storage was treated as a real data store. `flagged: string[]` per-quiz seeds the human-in-the-loop story.

**Tradeoff:** Slight over-engineering for MVP. ~15 lines. Cheap insurance + presentation point.

**Presentation note:** "Treated browser storage like a real data store — schema, version field, validated reads. The migration to a backend is a swap at one composable, not a rewrite."

---

## 9. Vue: composables only (no Pinia) + Vue Router

**Decision:** State via composables (`useQuizForm`, `useQuizState`, `useQuizStorage`, `useScoring`) — no Pinia. Vue Router with real routes: `/`, `/quiz`, `/results`, `/history`, `/history/:id`. Current-quiz state lives in composable (ephemeral), past quizzes in `/history/:id` (have real IDs in localStorage).

**Reasoning:** App has ~3 stateful concerns. Pinia adds a contract + dependency for what composables already do natively. Router gives bookmarkable history, back button, deep linking — free wins over conditional render.

**Tradeoff:** No Pinia devtools. Refactor seam if stores grow past ~3. Named in README.

**Presentation note:** "Reached for the smallest tool that fit. Pinia is the right call once stores grow past ~3 — named in README as a refactor seam."

---

## 10. Tool use shape: generator = 2-tool choice; classifier = 1 forced tool

**Decision:**

Classifier — single forced tool `classify_topic` with `tool_choice: { type: "tool", name: "classify_topic" }`. Schema: `{ viable, appropriate, intent, reason }`.

Generator — two-tool choice, model picks:
- `generate_quiz` — emits 5-question MCQ payload. `correct` field enum `["A","B","C","D"]`. `questions` `minItems: 5, maxItems: 5`.
- `refuse_topic` — emits `{ reason, category: "harmful" | "ungroundable" | "ambiguous" }`. UI maps to existing rejection states.

**Reasoning:** Two-tool choice is the *real* implementation of Layer 3 in the plan ("model can refuse independent of classifier"). Forcing `generate_quiz` makes Layer 3 prose-only theatre. Classifier output IS itself the refusal mechanism — no second tool needed there. Schema constraints (enum, minItems) catch the semantic-failure class of bug from Q6 at the API level.

**Tradeoff:** Two-tool choice slightly more complex prompt + parsing logic vs single forced tool.

**Presentation note:** "Defense in depth had to be real, not just prose in a system prompt. Two-tool choice gives the model an actual mechanism to refuse — Layer 3 isn't theatre."

---

## 11. Styling: Tailwind only, real palette (not default look)

**Decision:** Tailwind CSS. Custom `tailwind.config.ts` with a deliberate color palette + one Google font (Inter or similar). `@apply` for 2-3 repeated patterns (`.btn-primary`, `.card`). No shadcn-vue, no UnoCSS.

**Reasoning:** Consistent with `web-audit-tool`. Component libraries invite "why this lib?" questions; vanilla Tailwind keeps UI judgement clearly yours. Lock the look in the first 30 minutes of build — do not bikeshed later.

**Tradeoff:** Utility-soup markup. Mitigated by `@apply` for repeated patterns.

**Presentation note:** Not a talking point. Polished UI is table stakes — *not* polished is a tell. Don't ship the default Vite template look.

---

## 12. Tests: Vitest on deterministic logic only + prompt snapshot tests

**Decision:** Unit tests on `useScoring`, Zod schemas, deterministic helpers. Plus snapshot tests on the constructed classifier + generator prompts (`expect(buildGeneratorPrompt({...})).toMatchSnapshot()`). No component tests, no integration tests, no LLM assertions.

**Reasoning:** Scoring is where a bug = silent demo failure. Prompt snapshots lock the prompt as a versioned artifact — any unintentional change fails CI. Treats prompts as code, not strings. LLM itself isn't tested — non-deterministic, slow, expensive.

**Tradeoff:** No coverage on Vue components. Acceptable — components are thin in this architecture (logic lives in composables, which are tested via their pure helpers).

**Presentation note:** "Tests focus on the deterministic layer — scoring, validation, prompt construction. The LLM is treated as a tested-by-contract dependency; its output is validated by Zod at the boundary, not by integration tests that pay per run."

---

## 13. Flag UX: results screen only + category modal + real `/api/flags` endpoint

**Decision:** Flag button appears **on results screen only**, next to each question alongside correct answer + explanation. Click opens lightweight modal with category radio: `inaccurate | ambiguous | poorly_worded | other`. POSTs `{ quizId, questionId, category, topic, generatedAt }` to `/api/flags`, which logs to Vercel function logs (or Upstash list). Same Upstash rate limit applies.

**Reasoning:** During-quiz flagging biases the user's answers. After the user sees the correct answer + explanation is when "wait, that's wrong" becomes meaningful. Categories give structured data a review queue actually needs — free text won't be filled in. A real endpoint demonstrates the loop closes; localStorage-only is vapor.

**Tradeoff:** One extra click vs a one-tap toggle. Acceptable — flag is a rare action by definition.

**Presentation note:** "The whole presentation is 'this MVP is the seed of production HITL.' The flag captures structured signal in the shape a real review queue would consume. Storage backend is the easy swap."

---

## 14. Loading state: staged SSE phases + skeleton question cards; streaming named in README

**Decision:** `/api/generate` emits SSE events: `{ stage: 'wikipedia' }` → `{ stage: 'generating' }` → `{ stage: 'validating' }` → `{ stage: 'done', payload }`. Client cycles status copy + shows 5 skeleton question cards immediately. Streaming the tool use input JSON token-by-token (real per-question render) is named in README "Production Considerations" but not built.

**Reasoning:** 5-10s generator latency on a blank spinner = killer of perceived quality. Staged phases map to *real* backend phases (honest signal, not faked timing). "Reading Wikipedia" stage doubles as user-visible RAG demonstration. Streaming tool use input requires partial JSON parsing — non-trivial complexity for an MVP. Fallback: if Vercel hobby tier blocks SSE, switch to single-request + client-side fake stage timing (less honest, last resort).

**Tradeoff:** SSE has tier-dependent constraints on Vercel. Verify before relying on it.

**Presentation note:** "Loading isn't decoration — each stage is a real backend phase. Reviewer sees the architecture working. Streaming token-by-token render is named as the next step."

---

## 15. CI + commit hygiene: GH Actions (typecheck + test + build) + Vercel preview + conventional commits

**Decision:** GitHub Actions workflow on PR: `typecheck`, `test`, `build`. Vercel preview deploy on every PR (auto via Vercel integration). No CI lint — Prettier via local husky pre-commit only. Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). 15–30 atomic commits across build. No `WIP`/`asdf` commits in public log. One self-PR for final integration so reviewer has a unified diff.

**Reasoning:** Typecheck + test + build catches the three real classes of bug. Vercel preview on PR signals "ships professionally." Conventional commits make `git log --oneline` legible. Faking history (one big "initial commit") looks pasted — aim for natural cadence.

**Tradeoff:** Local husky adds a tiny install step. Worth it.

**Presentation note:** "Commits are the running record of decisions. I shape them deliberately because they're part of the readable artifact."

---

## 16. Accessibility: baseline (semantic HTML + ARIA live + focus management) — no automated a11y testing

**Decision:** Semantic `<form>`, `<fieldset>`, `<legend>`, `<input type="radio">` for options. `aria-live="polite"` on staged loading region. `aria-live="assertive"` on rejection/error. Focus management on view transitions (submit → focus to first question; submit quiz → focus to score). Visible `focus-visible:` ring. Tailwind palette verified WCAG AA contrast. No axe-core in CI.

**Reasoning:** Real production-thinking signal at low cost (~1.5 hours). Most a11y violations are the ones semantic HTML prevents at the source. axe-core in Vitest is real setup tax for marginal added catch on top of semantic baseline.

**Tradeoff:** No automated regression catch on a11y. Named in README "Production Considerations".

**Presentation note:** "Treated accessibility as a build-time concern, not a retrofit. Semantic markup, ARIA live regions on async state, focus management on view transitions."

---

## 17. Global error handling: Vue error boundary + `/api/errors` log endpoint

**Decision:** Root-level Vue error boundary (`app.config.errorHandler` + `onErrorCaptured` at route level). `ErrorBoundary.vue` fallback with "Reset" button (clears state, routes to `/`). Stack traces hidden in production (`import.meta.env.DEV` gate). Unexpected errors POST to `/api/errors` → Vercel function logs. Sentry/Datadog named in README, not built. Network drop mid-SSE: retry once, fall back to non-streaming fetch.

**Reasoning:** Unhandled errors crash to white screen mid-demo. Boundary + Reset is ~15 lines of insurance. `/api/errors` mirrors the flag-endpoint pattern from Q13 — local capture, production routing named. Same repeated rhetorical pattern across the README.

**Tradeoff:** No real-time error alerts. Acceptable for MVP — logs in Vercel dashboard.

**Presentation note:** "Errors are structured signals, not red text in a console. Same pattern as flagged questions — locally logged, production-routed."

---

## 18. Difficulty UX: two-step flow (topic → difficulty → submit), default Medium

**Decision:** Two-step submission. Step 1: topic input. Step 2: difficulty selector (radio pills, Easy/Medium/Hard). Default Medium. Difficulty stored with topic in `useQuizForm()` composable. Passed to `/api/generate` body. Stored on each quiz record in localStorage.

**Reasoning:** Two-step makes difficulty a deliberate moment in the flow, not a quick toggle. Demos as intentional rather than fast. Medium default avoids both "first quiz is trivial" and "first quiz too hard on niche topic."

**Tradeoff:** One extra click vs single-screen. User chose the deliberate-moment framing over friction-minimization.

**Presentation note:** "Difficulty isn't a feature, it's a prompt parameter. Same generator, different system prompt clause. Demonstrates that prompt architecture is composable, not monolithic."

---

## 19. Env vars: `.env.example` checked in, `.env` gitignored, README documents each var

**Decision:** `.env.example` in repo with all required + optional vars. `.env` gitignored. README documents each var's purpose and where to get it. No Zod validation on env (deferred from D recommendation — keeping setup simple).

Required vars:
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional:
- `ANTHROPIC_MODEL_CLASSIFIER` (default `claude-haiku-4-5-20251001`)
- `ANTHROPIC_MODEL_GENERATOR` (default `claude-sonnet-4-6`)

Hard rules: No `VITE_*` prefix on any secret. Server-only vars never imported by client code. CI doesn't need secrets (no LLM tests). Vercel preview inherits production env.

**Reasoning:** B over D — pragmatic for MVP. `.env.example` IS the setup-instruction artifact.

**Tradeoff:** Malformed env values fail at first call instead of startup. Acceptable for solo MVP.

**Presentation note:** Silent floor. Not a lead talking point.

---

## 20. Anthropic SDK config: 15s/45s timeouts, SDK retries disabled, max_tokens 8192

**Decision:**
- Timeouts: 15s classifier, 45s generator
- `maxRetries: 0` on SDK — your tiered retry from Q6 is the only retry layer
- `max_tokens: 8192` on generator (safe headroom for Hard difficulty)

**Reasoning:** SDK default 10min timeout is way too long for UI demo. SDK silent retries stack invisibly on top of Q6's typed retry — disabling them gives one layer, instrumented, owned. 4096 max_tokens risks truncation on Hard 5-question with long explanations → triggers tier-(2) retry burns a call. 8192 costs nothing extra on emission.

**Tradeoff:** Manual retry logic must handle 429/5xx explicitly. Acceptable — Q6 already does.

**Presentation note:** "Disabled SDK-level retries — I want one layer that I own and can reason about, not two stacked layers with different policies."

---

## 21. Build foundations: npm + TS strict-plus + Node 20 + Vite

**Decision:**
- Package manager: **npm** (zero-friction `npm install` for any reviewer)
- TS: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`
- Node: `"engines": { "node": ">=20" }` in `package.json`. No `.nvmrc`
- Build: Vite + `@vitejs/plugin-vue`. Path alias `@/*` → `src/*`. Skip auto-import, PWA, compression plugins. `vite.config.ts` under 30 lines

**Reasoning:** Friction-free clone-install for any reviewer. Strict-plus TS treats the type system as a correctness tool, not decoration. `noUncheckedIndexedAccess` catches `questions[i]` access bugs.

**Tradeoff:** ~30 extra minutes battling types early on. Pays back as "the types in this repo are real."

**Presentation note:** Silent floor. If asked: "I treat the type system as a correctness tool, not a syntax flavor."

---

## 22. README structure (revised)

```
1. Live Demo                            — big Vercel link at top
2. What This Is                         — 2 sentences + screenshot/GIF
3. The Through-Line                     — plan's quote as blockquote
4. Architecture                         — ASCII/Mermaid diagram + stack table
5. Decisions and Reasoning              — 8 subsections (the heart of the doc)
    a. Model selection (Haiku/Sonnet split)
    b. Two-tool generator (defense-in-depth as mechanism)
    c. Wikipedia server-side RAG + fuzzy fallback → fail closed
    d. Prompt caching on static system block
    e. Tiered retry (typed by failure mode)
    f. Where AI does and doesn't do work (scoring deterministic)
    g. Pre-flight classifier as separate prompt (single responsibility)
    h. Defense in depth on content safety (3 named layers)
6. Production Considerations            — repeating "MVP does X / prod does Y" pattern
    - localStorage → real datastore
    - Streaming tool-use input → per-card render
    - Sentry/Datadog for error tracking
    - Cloudflare Turnstile for bot-class abuse
    - Flag queue → labeled training set + secondary validator
7. What I'd Build Next                  — 3 bullets, signal of taste
8. Setup                                — clone, npm install, .env, npm run dev
9. Tech Stack                           — one-line list, deliberately low
```

**Reasoning:** Decisions section moves up. "Production Considerations" uses a repeated rhetorical pattern across 5 entries. Live demo at #1. No "excited to share" opener. No embedded resume/pitch. No emoji-flourish section headers.

**Tradeoff:** Longer README than minimal. Cap at 600 lines.

**Presentation note:** README is the cold-read artifact. Decisions section is the heart — make sure a reviewer who reads only sections 1, 3, and 5 gets the full picture.

---

## Cross-cutting through-lines for the live presentation

Pulled from the decisions above. Reuse verbatim:

1. **Matched model tier to task** (Q2) — Haiku for cheap pre-flight, Sonnet for grounded generation, Opus named for production escalation.
2. **Defense in depth is mechanism, not prose** (Q10) — two-tool choice on the generator makes Layer 3 real, not theatre.
3. **Failed closed on missing grounding** (Q7) — no Wikipedia = no quiz. Hallucination prevention is the feature.
4. **Typed failure modes, not blanket retry** (Q6) — semantic failures and transient failures get different responses.
5. **Repeated MVP-vs-production pattern** (Q4, Q13, Q14, Q17) — local capture + named production swap. Five places where the same rhetorical shape appears in the README.
6. **Deterministic seams around the LLM** (Q12) — scoring, validation, prompt construction are pure and tested. LLM is a tested-by-contract dependency.
7. **Cached the static, paid for the dynamic** (Q5) — prompt caching is an architecture decision, not a config toggle.
8. **Flag button as HITL seed** (Q13) — structured signal in the shape a real review queue would consume. Storage is the easy swap.

---

*Decisions locked 2026-05-11. Any scope/feature change should be reflected in plan.md and either supersede an entry here or add a new one.*
