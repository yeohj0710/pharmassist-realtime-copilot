# Multi-Symptom Consultation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 상담에서 확인된 여러 증상을 독립적으로 기억하고, 안전 규칙을 공유하면서 증상별 후보와 다음 질문을 한 화면에 종합한다.

**Architecture:** `ConsultationState`에 증상별 프로토콜·슬롯·질문 상태를 보관하는 `topics`를 추가한다. 런타임은 새 입력에서 확인된 프로토콜을 기존 주제와 병합하고 각 프로토콜을 결정론적으로 평가한 뒤, 하나의 우선 질문과 여러 `topic_results`를 반환한다. 기존 `decision`은 현재 대화 초점과 API 호환성을 위해 유지한다.

**Tech Stack:** TypeScript, JSON Schema, React, Vitest, Playwright

---

### Task 1: 다중 증상 회귀 재현

**Files:**

- Modify: `apps/web/src/actual-pack.test.ts`

- [ ] 목 통증 다음에 속쓰림을 입력하는 테스트를 추가한다.
- [ ] 현재 런타임이 마지막 프로토콜 하나만 반환해 테스트가 실패하는지 확인한다.

Run: `pnpm --filter @pharmassist/web test -- actual-pack.test.ts`
Expected: `topic_results` 또는 `topics`가 없어 실패한다.

### Task 2: 상담 상태와 출력 계약 확장

**Files:**

- Modify: `packages/contracts/schemas/consultation_state.schema.json`
- Modify: `packages/contracts/schemas/runtime_output.schema.json`
- Generate: `packages/contracts/src/generated/*`
- Generate: `packages/contracts/openapi/openapi.json`

- [ ] `topics`에 주제별 protocol, intent, answered slots, asked slots, pending slot을 정의한다.
- [ ] `topic_results`에 증상별 결정과 열린 질문을 정의한다.
- [ ] `pnpm schema:generate`로 타입과 OpenAPI를 갱신한다.

### Task 3: 상태 병합과 다중 프로토콜 평가

**Files:**

- Modify: `packages/recommendation/src/index.ts`
- Modify: `packages/recommendation/src/index.test.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/src/index.test.ts`

- [ ] 기존 주제를 삭제하지 않고 새 프로토콜을 병합한다.
- [ ] 주제별 슬롯과 질문 기록을 분리한다.
- [ ] 현재 입력이 답변이면 초점 주제에만 저장하고, 새 증상이면 새 주제를 추가한다.
- [ ] 모든 주제를 평가하되 화면 질문은 임상 우선순위에 따라 하나만 선택한다.
- [ ] 하나라도 refer이면 모든 제품 후보를 제거하고 전환 결과를 우선한다.

### Task 4: 여러 증상 결과 표시

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/consult-memory.ts`
- Modify: `apps/web/src/styles.css`

- [ ] 메인 문장에 현재 확인된 증상들을 함께 명시한다.
- [ ] 증상별 성분·제품 후보를 분리된 소제목으로 렌더링한다.
- [ ] 현재 질문과 관련된 주제를 먼저 표시하고 다른 주제는 보조 결과로 유지한다.

### Task 5: AI 보정 불변성

**Files:**

- Modify: `packages/openai-adapter/src/index.ts`
- Modify: `packages/openai-adapter/src/index.test.ts`

- [ ] AI가 `topic_results`를 변경하거나 누락하지 못하도록 안정 투영에 포함한다.
- [ ] 여러 증상을 한 제품으로 축약하지 않도록 프롬프트와 검증을 갱신한다.

### Task 6: 전체 검증

**Files:**

- Modify: `tests/e2e/consult.spec.ts`

- [ ] 목 통증과 속쓰림이 모두 화면에 남는 E2E를 추가한다.
- [ ] `node scripts/build-actual-preview-pack.mjs`를 실행한다.
- [ ] `pnpm check`, `pnpm test:e2e`, `pnpm test:security`를 실행한다.
- [ ] 14173 실제 화면에서 연속 입력과 종합 결과를 확인한다.
