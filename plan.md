# AI Quiz Builder — Project Plan

## Objective
Build a web-based MVP quiz app that generates multiple-choice questions from a user-provided
topic using an LLM, with a focus on clean architecture, thoughtful AI integration, and
defensible engineering decisions.

---

## Delivery
- GitHub repo with clean, readable commit history
- Live deployed link via Vercel (linked at top of README)
- README.md covering architecture, decisions, tradeoffs, and production considerations

---

## Stack
| Layer | Choice | Reasoning |
|---|---|---|
| Frontend | Vue 3 + TypeScript | Aaron's strongest framework; explicitly listed in Entrata job postings |
| AI Model | Claude (Anthropic SDK) | Anthropic explicitly named in Entrata job postings; strong structured output reliability |
| Schema Validation | Zod | TypeScript-native; catches malformed LLM responses before they reach UI |
| Persistence | localStorage | Keeps scope tight; production alternative acknowledged in README |
| Context Retrieval | Wikipedia REST API | Free, no auth required; grounds factual accuracy; implements RAG pattern |
| Hosting | Vercel | Free, fast deployment; frictionless for reviewer |

---

## Feature Set

### MVP (Required)
- [ ] Topic text input field
- [ ] Generate 5 multiple-choice questions with 4 options each (A–D)
- [ ] Answer selection UI
- [ ] Score display on submission (e.g. 3/5 correct)
- [ ] Correct answers revealed after submission

### Bonus Features (All Three)
- [ ] Wikipedia context injection — fetch summary and inject into generation prompt
- [ ] Persist quiz results in localStorage — reviewable via quiz history view
- [ ] Explanation of why each answer is correct or incorrect

### Beyond the Bonus
- [ ] Difficulty selector (Easy / Medium / Hard) — parameterizes the generation prompt
- [ ] Flag a question as inaccurate — explicit human-in-the-loop touchpoint
- [ ] "Quiz Again" and "New Topic" end-state buttons — no dead ends after score display
- [ ] Input validation and content safety layer (see below)

---

## Input Validation and Content Safety

### Categories of Bad Input
1. **Empty or meaningless** — blank field, random characters, single letters
2. **Nonsensical but harmless** — "purple elephants riding motorcycles" — not quizzable
3. **Vulgar or crude language** — swear words, sexual language, slurs — language itself is the problem regardless of underlying topic intent
4. **Borderline or sensitive topics** — politically inflammatory, personally targeted, ambiguous intent
5. **Explicitly harmful topics** — violence, illegal activity, hate speech, dangerous content

### Three Defensive Layers (Defense in Depth)

**Layer 1 — Client-Side Validation (free, instant)**
- Empty input: submit button disabled
- Too short (< 3 characters): inline error, no API call
- Too long (> 100 characters): inline error, prompt injection prevention
- No API call is made until this passes

**Layer 2 — LLM Pre-Flight Classifier (lightweight, separate API call)**

A dedicated classification prompt fires before question generation. Returns structured JSON:
```json
{
  "viable": true,
  "appropriate": true,
  "intent": "legitimate",
  "reason": ""
}
```
- `viable` — is this a real, quizzable topic with enough factual content?
- `appropriate` — is it free of harmful, explicit, vulgar, or offensive content?
- `intent` — attempts to infer whether vulgar input was careless vs. deliberate
- `reason` — plain-language explanation if either flag is false

If `viable: false` → "This topic doesn't have enough factual content to generate reliable questions. Try something like a historical event, scientific concept, or geographic region."

If `appropriate: false` due to vulgar language → "Your topic contains language that isn't appropriate here. If you meant [cleaned interpretation], try rephrasing it."

If `appropriate: false` due to harmful content → "This topic isn't something we can generate a quiz about. Please try a different topic."

**Layer 3 — System Prompt Guardrails on Generation**
- Generation prompt instructs the model to refuse and return `viable: false` if harmful or inappropriate content is detected — independent of the pre-flight check
- Belt-and-suspenders: no single layer is relied upon alone

### UX Principles for Rejection States
- Never dead-end the user — always return to input field with helpful guidance
- Distinguish clearly between "not quizzable" and "not appropriate"
- Specific and helpful messaging, never preachy
- Suggest example topics on rejection

---

## Prompt Architecture

### Two Separate Prompts (Modular, Independently Updatable)

**Prompt 1 — Pre-Flight Classifier**
- Lightweight, fast, cheap
- Returns structured JSON only
- Evaluates viability, appropriateness, and intent
- No question generation logic — single responsibility

**Prompt 2 — Question Generator**
- Fires only after classifier passes
- Wikipedia context injected as grounding source
- Difficulty level passed as parameter
- Explicit instructions:
  - Generate questions with exactly one unambiguously correct answer
  - Avoid questions where multiple options could be defensible
  - Avoid opinion-based, context-dependent, or debatable questions
  - Favor specific, factual question types
  - Do not introduce facts outside the provided Wikipedia context
  - Return structured JSON only — no markdown, no preamble
  - Include explanation for each correct answer

### Structured Output Format
```json
{
  "topic": "string",
  "difficulty": "easy | medium | hard",
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": {
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      },
      "correct": "A | B | C | D",
      "explanation": "string"
    }
  ]
}
```

### Difficulty Parameterization
| Level | Question Type | Focus |
|---|---|---|
| Easy | Definitional | "What is X", "Which term describes X" |
| Medium | Application | "Which of the following is an example of X" |
| Hard | Synthesis | Requires connecting multiple concepts, nuanced distinctions |

### Where AI Does and Doesn't Do Work
- **AI handles:** question generation, explanation generation, pre-flight classification
- **Deterministic logic handles:** scoring, answer comparison, result calculation
- Scoring never touches the LLM — this is an explicit architectural decision

---

## Human-in-the-Loop Design

| Touchpoint | How It Works |
|---|---|
| Input validation | System pauses before any API call — user confirms topic |
| Pre-flight classifier | Lightweight check gates generation — human sees rejection reason |
| Flag a question | User can mark any question as potentially inaccurate |
| Score review | User reviews results with correct answers and explanations |

**In a production system**, flagged questions would feed a review queue, patterns in flags would inform prompt refinement, and a secondary validation model or human reviewer would adjudicate edge cases. The flag button in this MVP is the seed of that loop — worth calling out explicitly in the presentation.

---

## Application Flow

```
User enters topic
  → Client-side validation
    → [fail] inline error, no API call
    → [pass] Pre-flight classifier API call
      → [fail] rejection message, return to input
      → [pass] Wikipedia REST API fetch
        → Question generation API call
          → Zod schema validation
            → [fail] retry logic (up to 2 retries)
            → [pass] Render quiz UI
              → User selects answers
              → User submits
                → Deterministic scoring
                  → Score display + correct answers + explanations
                    → Save to localStorage
                      → Quiz Again / New Topic
```

---

## Component Structure

```
src/
├── components/
│   ├── TopicInput.vue        # Input field, difficulty selector, submit
│   ├── QuizQuestion.vue      # Single question with options and flag button
│   ├── QuizResults.vue       # Score, correct answers, explanations
│   ├── QuizHistory.vue       # Past quiz results from localStorage
│   └── ErrorState.vue        # Rejection and error messaging
├── composables/
│   ├── useClassifier.ts      # Pre-flight classifier logic
│   ├── useQuizGenerator.ts   # Wikipedia fetch + question generation
│   ├── useQuizStorage.ts     # localStorage read/write
│   └── useScoring.ts         # Deterministic scoring logic
├── prompts/
│   ├── classifier.ts         # Pre-flight classifier prompt template
│   └── generator.ts          # Question generation prompt template
├── schemas/
│   ├── classifierSchema.ts   # Zod schema for classifier response
│   └── quizSchema.ts         # Zod schema for generated quiz
├── types/
│   └── quiz.ts               # Shared TypeScript interfaces
└── App.vue
```

---

## README Structure
1. Live demo link
2. Overview — what it does and why the decisions were made
3. System architecture diagram or flow description
4. Key technical decisions and reasoning
   - Model selection
   - Prompt architecture
   - Content safety layering
   - Structured output and validation
   - Where AI does and doesn't do work
   - localStorage vs. production datastore
5. Tradeoffs and known limitations
6. What a production version would look like
7. Setup instructions (clone, install, .env, run)
8. One paragraph connecting these patterns to internal AI infrastructure broadly

---

## Presentation Through-Line
> "Every decision I made was about reducing the places where the model could fail —
> through grounding, validation, and human oversight — while being honest about where
> the gaps still exist and what a more robust production version would look like."

---

## Strategic Choices to Articulate in the Live Discussion
- **Web over CLI** — adoption and usability argument, not aesthetics; non-technical users can engage with it immediately
- **Vue + Anthropic SDK** — directly aligned with tools named in Entrata's job postings
- **Two-prompt modular architecture** — single responsibility, independently testable, easier to maintain
- **Defense in depth on content safety** — no single layer is relied upon; named explicitly as a security engineering principle
- **Wikipedia RAG pattern** — named correctly; connects to production AI architecture patterns
- **Scoring is deterministic** — explicit about where AI does and doesn't touch the output
- **localStorage with production acknowledgment** — honest about scope, aware of what comes next
- **Flag button as human-in-the-loop seed** — connects MVP feature to production oversight design

---

*Last updated before build. Any changes to scope or features should be reflected here first.*
