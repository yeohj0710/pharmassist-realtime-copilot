# Structured Consultation Dialogue Implementation Plan

> **For agentic workers:** Execute the checked tasks inline in this session. Do not commit, push, deploy, reset, clean, move, delete, or restore the user's root files.

**Goal:** Treat every submitted utterance as customer speech and every rendered guidance line as counselor-ready speech while generating follow-up questions from the actual symptom context instead of fixed example body parts.

**Architecture:** Add one deep dialogue module with a small interface for structured turns, model-role conversion, counselor-turn replacement, patient-summary extraction, Korean particles, and question-template rendering. Keep clinical decisions deterministic; the normalizer extracts reusable symptom entities, protocol data stores question templates, and the recommendation module renders the final counselor question from verified slots.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Vitest 4, Playwright, pnpm workspaces.

---

### Task 1: Lock the reported defect with failing tests

**Files:**

- Modify: `apps/web/src/actual-pack.test.ts`
- Modify: `packages/normalizer/src/index.test.ts`

- [ ] Add a runtime test that submits `무릎이 아파요` and expects the question to contain `무릎` and not `어깨`.
- [ ] Add normalizer table tests for shoulder, knee, waist, wrist, ankle, elbow, hip, neck, arm, and leg body sites.
- [ ] Run `pnpm vitest run apps/web/src/actual-pack.test.ts packages/normalizer/src/index.test.ts --config vitest.config.ts` and confirm the new knee test fails before implementation.

### Task 2: Add the deep dialogue module

**Files:**

- Create: `packages/dialogue/package.json`
- Create: `packages/dialogue/tsconfig.json`
- Create: `packages/dialogue/src/index.ts`
- Create: `packages/dialogue/src/index.test.ts`

- [ ] Define `DialogueTurn` with `speaker: "customer" | "counselor"` and `text`.
- [ ] Implement `customerTurn`, `upsertCounselorTurn`, `serializeDialogueTurns`, `parseDialogueTurns`, `toModelConversation`, `buildCustomerSummary`, and `renderQuestionTemplate` behind one interface.
- [ ] Support `{{slot|fallback|topic}}`, `{{slot|fallback|subject}}`, and `{{slot|fallback|object}}` placeholders with Korean final-consonant particle selection.
- [ ] Reject unknown placeholders and leave no template token in rendered counselor text.
- [ ] Test structured roles, legacy serialization compatibility, customer-only summaries, and `무릎은`/`어깨는` rendering.

### Task 3: Extract reusable symptom entities

**Files:**

- Modify: `packages/normalizer/src/index.ts`
- Modify: `packages/normalizer/src/index.test.ts`

- [ ] Add one anatomy lexicon that maps colloquial variants to canonical `body_site` values.
- [ ] Store the matched canonical value in `NormalizedInput.slots.body_site` with derived provenance and the matched span.
- [ ] Keep the extractor independent of any one protocol or reported screenshot.
- [ ] Run normalizer and dialogue tests.

### Task 4: Render protocol questions from context

**Files:**

- Modify: `data/actual-research-overlays/option-selection.json`
- Modify: `scripts/build-actual-preview-pack.mjs`
- Modify: `packages/recommendation/package.json`
- Modify: `packages/recommendation/tsconfig.json`
- Modify: `packages/recommendation/src/index.ts`
- Modify: `packages/recommendation/src/index.test.ts`

- [ ] Replace the muscle-pain example body part with `{{body_site|아픈 부위|topic}}`.
- [ ] Validate all template placeholders while building the research preview pack.
- [ ] Render the question inside `nextProtocolQuestion` from current normalized slots and persisted answered slots before exposing it to runtime callers.
- [ ] Add tests for knee, shoulder, and missing-body-site fallback rendering.
- [ ] Rebuild the pack and confirm no unrendered `{{...}}` token reaches runtime output.

### Task 5: Use structured customer/counselor turns end to end

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/consult-memory.ts`
- Modify: `apps/web/src/consult-memory.test.ts`
- Modify: `apps/web/src/ai-fallback.ts`
- Modify: `apps/web/src/ai-fallback.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `packages/openai-adapter/src/index.ts`
- Modify: `packages/openai-adapter/src/index.test.ts`
- Modify: `packages/openai-adapter/prompts/runtime_system_prompt.md`
- Modify: `packages/openai-adapter/prompts/runtime_refiner_prompt.md`

- [ ] Store browser history as `DialogueTurn[]`; submitted text always creates a customer turn and local/AI output only replaces the counselor turn for the same sequence.
- [ ] Serialize to the current string-array transport only at the HTTP seam and parse it immediately in the API.
- [ ] Build OpenAI `user` and `assistant` roles only through `toModelConversation`.
- [ ] State in both model prompts that user content is customer speech and generated wording is what the pharmacy counselor can say aloud.
- [ ] Rename rendered labels to `손님에게 이렇게 물어보세요` when a question is open, `손님에게 이렇게 말해보세요` otherwise, and `이번 손님 정보` in the side summary.
- [ ] Test that customer facts never include counselor text and AI refinement cannot reverse speaker roles.

### Task 6: Remove duplicated symptom-copy shortcuts from runtime

**Files:**

- Modify: `packages/runtime/src/index.ts`
- Modify: `data/actual-research-overlays/option-selection.json`
- Modify: `apps/web/src/actual-pack.test.ts`

- [ ] Move the generic cough pattern question into the protocol overlay so the pack supplies it through the same question interface.
- [ ] Delete the runtime-only generic cough question constant and use the normal retrieval/progressive-question path.
- [ ] Keep conversation-only cards as the source of greeting and unsupported-intent wording; remove duplicate greeting replies from runtime after regression tests prove the pack path.
- [ ] Preserve the existing conservative behavior when the customer cannot answer a question.

### Task 7: Verify behavior and rendered layout

**Files:**

- Modify: `tests/e2e/consult.spec.ts`
- Modify: `apps/web/src/styles.css` only if rendered labels or layout need spacing adjustments.

- [ ] Update the muscle-pain E2E case to submit `무릎이 아파요` and assert the center asks about the knee while the provisional product remains in the right sidebar.
- [ ] Add assertions that the main guidance label describes counselor speech and the side heading describes the current customer.
- [ ] Run `node scripts/build-actual-preview-pack.mjs`, `pnpm check`, `pnpm test:e2e`, and `pnpm test:security`.
- [ ] Verify the live browser at desktop and mobile widths, check zero console errors, and confirm 14173 remains owned by PharmAssist.
