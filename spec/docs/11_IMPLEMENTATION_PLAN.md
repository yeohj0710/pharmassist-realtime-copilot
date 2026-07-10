# 11. Implementation Plan

각 단계는 배포 시간이 아니라 **의존성과 완료 조건**을 기준으로 한다.

## Phase 0 — Repository and contracts

### 구현

- pnpm/Turborepo monorepo
- TypeScript strict baseline
- JSON Schema package와 generated types
- ESLint/Prettier or equivalent
- Vitest/Playwright
- Docker/CI
- environment/config loader

### 완료 조건

- clean install
- lint/typecheck/test green
- schema examples validate
- no secrets in repo
- CI artifact and SBOM 생성

## Phase 1 — Typed local engine

### 구현

- normalizer
- PII redactor
- Korean negation/temporal parser
- slot extractor
- red-flag engine
- alias/rule/BM25 retrieval
- candidate scoring/hysteresis
- Web Worker
- PWA UI
- synthetic knowledge pack

### 완료 조건

- OpenAI key 없이 완전 실행
- golden sample 50건 통과
- exact P95 ≤ 250ms on benchmark hardware
- offline reload 가능
- no raw text logs

## Phase 2 — Knowledge authoring and compiler

### 구현

- source/claim/card/product registry
- importer skeleton
- candidate extractor adapter
- policy lint
- reviewer console
- conflict/expiry workflow
- pack compiler/signature/publish/rollback

### 완료 조건

- draft→review→publish state machine
- C/D/X claim이 production에 들어가면 build failure
- source→claim→card 추적
- synthetic placeholder production block
- signed pack hot update/rollback test

## Phase 3 — Responses refinement

### 구현

- PHI redacted request builder
- OpenAI Responses adapter
- Luna/Terra routing
- strict Structured Outputs
- SSE streaming
- timeout/abort/stale drop
- post-generation validator
- mock provider

### 완료 조건

- local card remains on all failures
- unsupported claim/number injection rejected
- sequence race tests pass
- `store:false` asserted in contract tests
- raw prompt/output absent from logs

## Phase 4 — Realtime transcription

### 구현

- push-to-talk UI
- server session/unified WebRTC endpoint
- Realtime event reducer
- partial/final transcript handling
- stable prefix detector
- domain vocabulary/alternatives
- reconnect/fallback
- visible consent/mic states

### 완료 조건

- browser standard key exposure 0
- partial red-flag behavior
- audio not persisted by app
- voice stable-prefix→card P95 target
- noisy Korean audio eval report
- mic failure falls back to typing

## Phase 5 — Official source adapters

### 구현

- approved MFDS product sync/import
- HIRA DUR import/adapter where permitted
- source snapshot/hash/diff
- product active ingredients/concentration
- deterministic duplicate and calculation modules
- expiry/change impact graph

### 완료 조건

- every product rule source traceable
- changed label stales affected cards
- calculations match fixture labels
- licensing/terms documented
- high-risk cards have pharmacist approval

## Phase 6 — Pilot hardening

### 구현

- shadow mode
- coded feedback
- dashboards/alerts
- kill switch
- privacy/security tests
- accessibility/usability improvements
- installation/runbooks

### 완료 조건

- pharmacist-reviewed gold suite
- safety/latency release gates
- incident/rollback drill
- legal/privacy/regulatory sign-off checkpoints recorded
- pilot pharmacy training material

## Phase 7 — Additional domains

처방 복약지도, 건기식, 동물약은 각각 별도 feature flag, pack, reviewer matrix, test suite로 추가한다. 사람 OTC의 index와 규칙을 공유하더라도 domain filter가 compile-time/runtime 모두에서 강제되어야 한다.

## Work breakdown by package

### `packages/domain`

- generated schema types
- enums/value objects
- slot/result/card/claim types
- invariants

### `packages/normalizer`

- Korean text normalization
- units/numbers
- PII
- negation/temporality
- alias alternatives

### `packages/safety`

- red flags
- blocking slots
- allergy/contraindication hooks
- numeric output gate
- domain isolation

### `packages/retrieval`

- index builder
- exact/trie
- rule engine
- BM25/fuzzy
- scoring/hysteresis

### `packages/knowledge`

- registries
- policy lint
- compiler
- signature/manifest
- update/rollback

### `packages/openai-adapter`

- Responses
- Realtime session/event types
- mock provider
- redacted payload builders
- strict output parser

### `apps/web`

- PWA
- Web Worker orchestration
- UI states/keyboard/accessibility
- service-worker pack cache

### `apps/api`

- auth/config
- Realtime session endpoint
- refinement SSE
- pack distribution
- feedback/audit
- health/readiness

### `apps/reviewer`

- source/claim/card review
- diff/conflicts/expiry
- publish/rollback

### `tools/ingest`

- inventory/extract/import adapters
- offline GPT extraction runner
- official source sync skeleton

### `tests`

- golden
- audio event replay
- security/privacy
- benchmarks

## Coding standards

- no `any` except isolated external boundary with validation
- exhaustive discriminated unions
- pure deterministic core
- dependency injection for clocks/model/provider/store
- all external data validated
- explicit error codes
- no catch-and-ignore
- cancellation/timeout on all network operations
- source/prompt/model/pack versions in results
- no TODO/FIXME in completion branch

## Documentation to ship

- local setup
- production config
- privacy settings
- knowledge authoring
- reviewer guide
- incident/rollback
- API/openapi
- benchmark command/results template
- threat model
- limitations and intended use
