# AI Quiz Builder — Speaker Notes

Companion to `index.html`. Read while presenting. One page per slide.
Audience: **Seth Beckett** (AI Engineer), **Lee Woodside** (Software Engineer), **Manish Ranjan** (Head of Technology, Resident Experience · AI & Automation).

Tailoring: model selection / RAG / tool use lands with Seth. Architecture / testing / TS strict lands with Lee. Defense in depth / HITL / production roadmap / cost controls land with Manish.

---

## How to run the deck

```bash
cd /Users/aaronmatson/Documents/Personal-Projects/Entrata/presentation
python3 -m http.server 8000
# open http://localhost:8000
```

Keyboard: `→` next, `←` back, `s` opens speaker view in a second window, `f` fullscreen, `esc` overview, `b` blank screen.

---

## Slide 1 — Title

Set the frame in one breath: "I'll walk through what I built, the decisions behind it, the bugs I found, and where production would diverge. About 15 minutes, then demo, then questions."

Don't lead with a resume slide — the build is the resume.

---

## Slide 2 — Through-line

Read the quote. Then: "That's the lens for every decision in this deck. If it doesn't reduce a place the model can fail, it didn't make the build."

Pause. Let it land before clicking.

---

## Slide 3 — What this is

30 seconds. The product in one sentence. The five bullets are a tour of the architecture *vocabulary* — RAG, tool use, deterministic scoring, structured flag signal. We'll come back to each.

If anyone says "show me" early — skip ahead to slide 22 and demo first, then come back.

---

## Slide 4 — Architecture

This is the slide you can defend for ten minutes if asked. Walk it left-to-right:

1. **Browser** is Vue 3 + TS. Three views: input, quiz, results.
2. **`/api/classify`** is Haiku 4.5, single forced tool — pre-flight gate on every submit.
3. **`/api/generate`** is the pipeline: Wikipedia fetch → Sonnet 4.6 with two-tool choice → Zod validation → SSE stages back to the client.
4. **`/api/flags`** and **`/api/errors`** are the telemetry surface — structured JSON in the shape a real review queue or Sentry would consume.
5. **Upstash** is the rate-limit floor. **SDK retries OFF** — one retry layer, one I own.

The point of the diagram: every box has a single responsibility and a named production-swap.

---

## Slide 5 — Stack

Don't read the table — point at it. Three things to call out aloud:

- **Strict++ TS** — `noUncheckedIndexedAccess` catches `questions[i]` access bugs the type system would normally let through.
- **Vue composables, no Pinia** — three stores doesn't justify Pinia. Refactor seam is named in the README.
- **Zod at every boundary** — same pattern from network response to localStorage read.

For Lee: emphasise composables + TS strict. For Seth: tool-use + structured tools. For Manish: the deploy-and-key story (one repo, key never crosses the wire).

---

## Slide 6 — Decision 1: Split the models

Sentence to use verbatim:

> "I didn't reach for the biggest hammer. I matched model tier to task — Haiku 4.5 for the pre-flight, Sonnet 4.6 for grounded generation. Opus 4.7 is what a production version would escalate to."

Anticipated follow-up (Seth): *"Why not Sonnet for both?"*

> "Rejection traffic is unbounded — every bad input pays the Sonnet rate. Haiku is correct here because the classifier is a small structured judgement that runs on every submit."

Anticipated follow-up (Manish): *"How do you measure if Haiku is good enough?"*

> "Snapshot tests on the classifier prompt + the test matrix in `decisions.md` — I ran a battery of educational, harmful, vague, and adversarial topics. The classifier correctly distinguishes intent rather than blocking keywords."

---

## Slide 7 — Decision 2: Two-tool choice

The sentence that does the work:

> "Defense in depth had to be real, not just prose in a system prompt. Two-tool choice gives the model an actual mechanism to refuse — Layer 3 isn't theatre."

Read the code block aloud — point at `tool_choice: { type: "any" }`. Highlight that the model *picks* between `generate_quiz` and `refuse_topic`, then the server branches on `block.name`. The schema does the rest.

Anticipated follow-up (Seth): *"Why not `tool_choice: { type: "auto" }`?"*

> "`auto` would let it answer in plain text, which is the failure mode I want to eliminate. `any` forces a tool call but lets the model choose which — exactly the property I want."

---

## Slide 8 — Decision 3: Fail closed

The sentence:

> "I chose to fail closed rather than ungrounded. It preserves the integrity of the RAG pattern. Hallucination prevention is the feature."

Anticipated follow-up (Manish): *"You're rejecting legitimate niche topics. How do you handle that in production?"*

> "Fall back to other knowledge sources — Britannica, a curated topic library, internal docs if this were enterprise. Never fall back to ungrounded generation. That undermines the whole story."

Right-column "user-visible proof" — the SSE `wikipedia` stage doubles as a UI affordance. Grounding isn't hidden behind a spinner; it's the loading copy.

---

## Slide 9 — Decision 4: Tiered retry

The sentence:

> "Tool use removes JSON-parse failure as a category. The failures that remain are semantic — I retry once with the validation error fed back, otherwise surface honestly."

Why SDK retries off (this is the line for Lee):

> "Stacking blind SDK retries on top of typed app-level retries hides timing from the user and the logs. One layer that I own, that I can reason about — not two layers with different policies."

Anticipated follow-up (Lee): *"Why only one retry per tier?"*

> "Caps worst-case latency at ~2x the generator call. Beyond that, you're trading user latency for a marginal improvement in success rate. One retry is the place where the curve turns."

---

## Slide 10 — Decision 5: Deterministic scoring

The sentence:

> "AI does the writing. Code does the math. Scoring never touches Claude."

The point: when someone asks "what happens if the LLM is wrong?", the answer is "the wrong answer is still scored correctly against the answer key the LLM committed to." That's the seam.

Anticipated follow-up (Manish, AI-and-Automation lens): *"What's the cost discipline here?"*

> "Every place I can do work without an LLM, I do. Scoring is the obvious one. Topic validation is another — length check happens client-side before any API call."

---

## Slide 11 — Decision 6: Three safety layers

Read the three layer cards. Then:

> "No single layer is relied upon alone. Each is independently testable — the classifier has snapshot tests on the prompt, the generator's tool schema rejects malformed output at the API, the client validator runs before any network call."

For Manish: this is the slide where you connect to the broader AI-safety conversation. Frame it as **layered controls**, not a single gate.

Anticipated follow-up: *"Where do you see this breaking?"*

> "The classifier is LLM-based, so its blind spots are LLM blind spots. The generator refusal is the catch for what the classifier missed. The flag endpoint is the catch for what both missed — that's where human oversight enters. The model isn't the last line of defence; the user is."

---

## Slide 12 — Decision 7: Prompt caching

The sentence:

> "Cached the static prefix — repeat generations hit roughly 90% input token discount. Production extension is per-topic Wikipedia caching with a longer TTL."

Anticipated follow-up (Seth): *"How do you verify the cache is actually hitting?"*

> "Anthropic returns `cache_read_input_tokens` and `cache_creation_input_tokens` on the message metadata. Easy to assert in a smoke test. I checked it manually but it's a natural place to add a CI guard."

---

## Slide 13 — Rate limiting + cost

The sentence:

> "Public AI endpoints are unpriced DDOS vectors. I rate-limited per IP and capped spend at the provider. Turnstile is named as the next layer for bot-class abuse."

For Manish: this is the cost-discipline slide. Three belts, each with a different failure mode covered.

Anticipated follow-up: *"Why Upstash specifically?"*

> "Stateless serverless can't share an in-memory counter across invocations. Upstash gives me a free-tier sliding-window primitive in about fifteen lines and two env vars. Same pattern would extend to a Redis cluster at scale."

---

## Slide 14 — Bugs found

Walk down the table. The point isn't that bugs happened — it's that they were caught and that each fix is *structural*, not patch-on-symptom:

- **Internal error string leaked.** Fix: HomeView never displays raw `result.reason` — a class of bugs collapses to one rule.
- **Flag POST silently dropped from history view.** Fix: both views go through the same composable.
- **Direct POST bypassed classifier.** Fix: classifier moved inside `/api/generate`. Gate is structural now, not client-trust.
- **No telemetry for blocked topics.** Fix: new endpoint, same contract as flag endpoint.
- **Flag schema accepted negative timestamps.** Fix: `.min(0)` on the Zod schema. One line.

The line to land:

> "Every fix collapsed a *class* of bug, not a single case. That's the test of a good fix."

---

## Slide 15 — Adversarial test run

Read down the table briefly. The narrative is: **most attacks were handled by the framework**, but two had to be hardened (prompt injection, direct POST bypass) and two were Zod issues (negative timestamp, array injection).

For Manish: this is the slide that shows the security mindset. For Seth: the prompt-injection hardening is worth a sentence — "the classifier was originally latching onto keyword shapes; I rewrote the prompt to look at intent rather than substrings, with snapshot tests to lock the change."

---

## Slide 16 — Validated topic outcomes

The key finding (read it aloud):

> "The gate is LLM-based intent classification, not a keyword blocklist. Educational historical content — Holocaust, slavery, Hiroshima, 9/11 — correctly passes. Instructional harm — how to make a bomb, how to synthesize meth — correctly blocks. That distinction is the right behaviour."

For Manish: this matters because keyword blocklists are how you end up unable to discuss the Civil War.

---

## Slide 17 — Testing strategy

The sentence:

> "Tests focus on the deterministic layer — scoring, validation, prompt construction. The LLM is treated as a tested-by-contract dependency; its output is validated by Zod at the boundary, not by integration tests that pay per run."

Anticipated follow-up (Lee): *"Coverage on Vue components?"*

> "Components are thin. Logic lives in composables, which are tested via their pure helpers. Acceptable for MVP — named in `decisions.md` as a tradeoff."

The CI block on the right is for Lee. Three checks: typecheck, test, build. Plus Vercel preview deploy on every PR — the reviewer gets a living URL, not a dev README.

---

## Slide 18 — MVP captures, production routes

Five rows. The pattern matters more than any single row:

> "The same shape across five subsystems — capture the right signal locally, name the production swap. Migration is a destination change, not a rewrite."

This is the slide Manish will care about most. Land the pattern, then offer to dive into any specific row.

---

## Slide 19 — HITL seed

The sentence:

> "The whole presentation is 'this MVP is the seed of production human-in-the-loop.' The flag captures structured signal in the shape a real review queue would consume. Storage backend is the easy swap."

Why categories and not free text:

> "Free text never gets filled in. Categories produce data a review queue can actually consume — `inaccurate`, `ambiguous`, `poorly_worded`, `other`."

Why on the results screen and not during the quiz:

> "During-quiz flagging biases the user's answers. After they see the correct answer + explanation is when 'wait, that's wrong' becomes meaningful."

---

## Slide 20 — What I'd build next

Three. Don't add a fourth. Each next-step extends an existing seam:

- **Streaming render** extends the SSE pattern from stages to token deltas.
- **Per-topic Wikipedia cache** extends prompt caching from the system block to context.
- **Stubbed-Anthropic E2E** extends the test pyramid without paying per run.

Pattern statement to land: "each next-step extends a seam that's already in the code — rather than introducing a new abstraction."

---

## Slide 21 — Through-lines

These are the eight things that, if a reviewer remembers only one, should be remembered. Don't read all eight aloud — pick three based on which audience member is leaning in:

- For Seth (AI engineer): #1 (tier-to-task), #2 (defense as mechanism), #7 (caching).
- For Lee (software engineer): #4 (typed retries), #6 (deterministic seams).
- For Manish (head of tech, AI/automation): #3 (fail closed), #5 (MVP/production pattern), #8 (HITL seed).

---

## Slide 22 — Live demo

Don't show every feature. Show **six scripted moments**, in order:

1. Type "the Krebs cycle" → click Medium → watch the SSE stages cycle.
2. While generating, open DevTools network tab — show `/api/generate` returning text/event-stream, no API key visible.
3. Answer the quiz. Submit. Show the results screen.
4. Flag one question (pick "ambiguous"). Show the POST to `/api/flags` in the network tab.
5. Back to home. Type "how to make a bomb". Show the rejection state — user-friendly, no internal error string.
6. Open History → click a past quiz → flag from there. Show the POST fires (this was the bug fix).

If time: type "Eifel Tower" (intentional typo) → show fuzzy fallback → quiz on "Eiffel Tower".

If asked to break it on the spot: have the adversarial topics ready (`Methamphetamine` direct, leet-speak `m3th`, Cyrillic lookalikes). Confidence here.

---

## Slide 23 — Thank you / Q&A

Don't end with "any questions?" — end with the invitation to pick a thread:

> "Happy to dig into any decision — the prompt architecture, the retry semantics, the safety layers, the production roadmap, or the parts that would change first at scale."

The list gives the reviewer permission to pick the most interesting angle.

---

## Likely questions, prepared answers

### "Why Vue and not React?"
Aaron's strongest framework. Composition API is closest to what good React with hooks looks like. Job description named Vue. Not a religious choice.

### "Why Anthropic and not OpenAI?"
Tool use was the deciding feature — Anthropic's structured tool input is the cleanest mechanism for "no free-form JSON parsing" in this space. Also named in Entrata's job posting.

### "What would change if this had a backend team and a year?"
- Real DB (Postgres) with the same `quiz_history` shape — schema is migration-ready.
- Sentry/Datadog instead of Vercel logs — same `/api/errors` contract, different destination.
- Labeled review queue from `/api/flags` feeding a secondary validator + training set.
- Per-topic Wikipedia cache with longer TTL.
- Streaming tool-use input deltas for per-card render.
- Opus 4.7 escalation tier for ambiguous high-stakes topics.
- Cloudflare Turnstile in front of public endpoints.

### "How do you know your prompts aren't drifting?"
Snapshot tests on the constructed classifier and generator prompts. Any unintentional change fails CI. Treats prompts as code, not strings.

### "What's the single biggest weakness of this MVP?"
Genuine answer: no E2E test of the full pipeline. The retry tiers and refusal paths are exercised manually, not in CI. That's #3 on the "what I'd build next" list for a reason.

### "If you had to ship this Monday, what would change first?"
The localStorage swap. Everything else is acceptable indefinitely; storage is the one thing that breaks across devices and sessions.

### "How do you think about cost at scale?"
Three places it shows up: model tier choice (Haiku where I can, Sonnet where I must), prompt caching on the static prefix (~90% input discount), and the rate-limit floor that caps blast radius. Spend cap at the provider is the final belt.

### "Talk me through what happens on a 429 from Anthropic."
The Anthropic SDK throws an `APIError`. My handler at the top of `/api/generate` catches it, classifies it as the "transient" tier, retries once with exponential backoff. If the retry also fails, the SSE stream emits a structured error event and the client surfaces a friendly retryable message. No silent swallowing.

### "What if Wikipedia is down?"
Same retry tier as Anthropic 5xx — one retry with backoff. If still failing: the user gets the "couldn't find background info" message, suggested topics, no generation. Fails closed.

### "Why no Pinia?"
Three stores. Composables already give me reactive state + dependency injection. Pinia adds a contract for what composables do natively at this size. Refactor seam is named in the README — past ~3 stores I'd swap.

### "What's your testing coverage number?"
Doesn't have one. Coverage as a metric is a poor proxy. What I test is the layer where a bug is silent — scoring, validation, prompt construction. Components are thin enough that the typecheck + the deterministic-layer tests catch the real failure modes.
