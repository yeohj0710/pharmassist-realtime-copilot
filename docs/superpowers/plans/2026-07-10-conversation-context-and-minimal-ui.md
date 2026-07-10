# Conversation Context and Minimal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve answered consultation slots across AI turns and reduce the result screen to one primary speaking prompt with compact optional support.

**Architecture:** The web client will include recent turn history in the refinement request, and the API prompt will treat that history plus the prior question as authoritative conversation context. The UI will retain the existing result contract but render `say_now` and `ask_next` as one focused prompt, moving metadata and secondary guidance into a collapsed disclosure.

**Tech Stack:** React 19, TypeScript, Fastify, OpenAI Responses API, Vitest, Playwright, CSS.

---

### Task 1: Preserve Follow-up Context

**Files:**

- Modify: `packages/contracts/schemas/refinement_request.schema.json`
- Modify: `apps/web/src/ai-fallback.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/api/src/app.ts`
- Test: `apps/web/src/ai-fallback.test.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] Add `conversation_history` to the refinement request schema as a bounded string array.
- [ ] Regenerate contract types and OpenAPI with `pnpm schema:generate`.
- [ ] Send recent user turns with every AI refinement request.
- [ ] Instruct the model not to ask for facts already present in conversation history.
- [ ] Add a regression test for `기침이 나요` followed by `어제부터요`.
- [ ] Run targeted Vitest suites and confirm the second response does not repeat the duration question.

### Task 2: Focus the Consultation UI

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Render one primary block containing only the exact sentence to say and the immediate next question.
- [ ] Remove visible confidence and workflow labels from the primary hierarchy.
- [ ] Move actions, avoid text, sources, version, and technical metadata into a compact collapsed `details` element.
- [ ] Reduce panel padding and vertical whitespace while preserving mobile readability.
- [ ] Keep input, AI status, new consultation, and push-to-talk controls.

### Task 3: Verify and Publish

**Files:**

- Sync runtime files under `C:\dev\PharmAssist\app`

- [ ] Run the real two-turn browser flow: `기침이 나요` then `어제부터요`.
- [ ] Verify the second result does not ask when the cough started.
- [ ] Capture desktop and mobile screenshots and inspect information hierarchy.
- [ ] Run `pnpm check`, `pnpm pack:verify`, and live health checks.
- [ ] Commit and push to `origin/main` without `.env` or credentials.
