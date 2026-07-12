# Fast Consult Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve emergency red-flag blocking while turning ordinary OTC demo consultations into a stateful one-to-two-turn flow that ends with useful candidate medication classes.

**Architecture:** Add a pure session-aware flow wrapper around `LocalClinicalEngine`. It accumulates only the current in-memory consultation turns, reruns safety over the combined text, and converts matched low-risk cards to a concise quick-result after sufficient context. The Worker owns this state by `session_id`; the React UI displays the compact result and supports an explicit new consultation.

**Tech Stack:** TypeScript, Web Worker, React, Vitest, Playwright.

---

### Task 1: Stateful flow

**Files:**

- Create: `apps/web/src/consult-flow.ts`
- Test: `apps/web/src/consult-flow.test.ts`

- [ ] Write tests proving a second short answer retains the first symptom and returns a quick candidate.
- [ ] Prove a red flag in any later answer still escalates.
- [ ] Implement bounded in-memory turn accumulation and quick-result mapping.

### Task 2: Worker and UI

**Files:**

- Modify: `apps/web/src/clinical-engine.worker.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Route Worker messages through the stateful flow.
- [ ] Clear the text input after submission and show the short conversation trail.
- [ ] Replace routine blocked language with `확인 중`, render `약 후보`, and add `새 상담`.

### Task 3: Verification

**Files:**

- Modify: `tests/e2e/consult.spec.ts`

- [ ] Add E2E for `기침이 나요` → `아침이요` → immediate candidate display.
- [ ] Run unit, typecheck, build, E2E, and accessibility checks.
- [ ] Rebuild the Windows launcher, commit, push, and verify GitHub Actions.
