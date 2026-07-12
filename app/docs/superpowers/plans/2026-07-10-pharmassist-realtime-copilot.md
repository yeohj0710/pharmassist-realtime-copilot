# Pharmassist Realtime Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable local-first pharmacist counseling copilot monorepo whose deterministic safety path works without OpenAI and whose clinical production profile fails closed without official approved knowledge.

**Architecture:** A strict TypeScript pnpm/Turborepo contains pure normalization, safety, retrieval, knowledge, and sequence-control packages shared by a browser Web Worker and Fastify API. Signed immutable knowledge packs feed the local engine; OpenAI Responses and Realtime remain optional, server-only adapters with deterministic mocks and post-validation. PostgreSQL stores authoring metadata and coded audit events only; no patient profile, audio, transcript, or prompt body tables exist.

**Tech Stack:** Node.js 24.12.0, pnpm 11.11.0, TypeScript 7.0.2, React 19.2.7, Vite 8.1.4, Fastify 5.10.0, Ajv 8.20.0, OpenAI SDK 6.46.0, Vitest 4.1.10, Playwright 1.61.1, PostgreSQL 17, Docker Compose, GitHub Actions.

---

## File map

- `packages/contracts`: copied source schemas, generated TypeScript, Ajv validators, extra envelopes, OpenAPI 3.1.
- `packages/domain`: value objects, error envelope, session/sequence state, invariants.
- `packages/normalizer`: Korean NFKC/spacing/unit/slot/PII/negation/person/temporality handling.
- `packages/safety`: ordered triage, domain, allergy, blocking-slot, product, source, and numeric gates.
- `packages/retrieval`: exact map, token trie, rules, BM25, trigram, explainable scoring, hysteresis.
- `packages/runtime`: deterministic normalize → safety → retrieve → render orchestration shared by worker/API.
- `packages/knowledge`: provenance policy, compiler, canonical JSON, Ed25519, atomic pack store, rollback/revoke.
- `packages/openai-adapter`: Responses request/stream adapter, Realtime broker/event reducer, mocks, post-validator.
- `packages/observability`: content-free allowlisted logs, metrics, traces, audit events.
- `packages/ui`: accessible status/card primitives shared by both React apps.
- `packages/test-fixtures`: synthetic-only sources, claims, cards, packs, runtime events, 100 supplied cases.
- `apps/web`: pharmacist PWA, worker, PTT WebRTC adapter, IndexedDB pack activation, offline service worker.
- `apps/api`: Fastify routes, mock-local/JWT auth hook, RBAC/tenant boundaries, SSE, pack serving, health.
- `apps/reviewer`: source/claim/card/review/compile/publish/rollback/revoke console using synthetic data.
- `tools/ingest`: safe inventory/import interfaces, mock extractor, official-source adapter contracts and diff.
- `tools/pack-cli`: lint/build/sign/verify/publish/rollback/revoke commands.
- `tools/benchmark`: deterministic exact/fuzzy/voice/pack/render benchmark JSON and Markdown reports.
- `database`: PostgreSQL migrations, synthetic seed, backup/restore scripts; no patient-content tables.
- `tests`: cross-package golden, adversarial, integration, security, E2E, and performance suites.
- `infra`: non-root Dockerfiles, Compose, observability examples, production deployment reference.
- `docs`: decisions, architecture, data flow, threat model, authoring, incident, OpenAI, legal, limitations, evidence.

### Task 1: Workspace and contract baseline

**Files:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `packages/contracts/**`, `docs/TRACEABILITY_MATRIX.md`

- [ ] Copy the six supplied schemas without semantic edits and add schemas for refinement, feedback, manifest, extractor, reviewer, and safe errors.
- [ ] Add `scripts/generate-types.mjs` using `json-schema-to-typescript`; generated files carry a source hash and are checked for drift.
- [ ] Build Ajv 2020 validators with `ajv-formats`; reject additional properties and invalid UUID/date-time/ranges.
- [ ] Generate `packages/contracts/openapi/openapi.json` and contract-test every route/request/response reference.
- [ ] Run `corepack pnpm install`, `pnpm schema:generate`, `pnpm schema:check`, `pnpm typecheck`; expected: all exit 0.
- [ ] Commit with `chore: bootstrap strict monorepo contracts`.

### Task 2: Korean normalizer and deterministic state

**Files:** `packages/domain/src/**`, `packages/normalizer/src/**`, `packages/normalizer/test/**`

- [ ] Write failing tests for NFKC, control removal, whitespace, Korean/ASCII units, age/weight/time, IME composition guard, aliases, and alternatives.
- [ ] Add phone/email/RRN/address/payment detectors returning redacted text, findings, and `safeForExternal`; uncertain names set it false.
- [ ] Add negation windows, double-negation ambiguity, sentence boundaries, current/past/possible, self/family/other scope, and provenance-bearing slots.
- [ ] Add immutable session state with UUIDs, monotonic sequence, freeze, critical lock, acknowledgement, and stale-drop reducers.
- [ ] Run `pnpm --filter @pharmassist/normalizer test`; expected: all tests pass with no skipped cases.
- [ ] Commit with `feat: add privacy-safe Korean normalization`.

### Task 3: Safety-first retrieval runtime

**Files:** `packages/safety/src/**`, `packages/retrieval/src/**`, `packages/runtime/src/**`, corresponding tests

- [ ] Write failing tests proving triage executes first and cannot be offset by ranking.
- [ ] Implement critical patterns for supplied synthetic cases with negation/person/temporality evidence and immediate partial-input bypass.
- [ ] Implement domain, allergy, contraindication hook, blocking slot, exact product/concentration, card status/source, and numeric gates in contract order.
- [ ] Implement exact aliases, multi-token trie, deterministic rules, Korean token+bi/tri-gram BM25, optional trigram similarity, and explainable features.
- [ ] Implement hysteresis, margin, freeze, critical lock, sequence, ambiguous top-3, no-match, and safe render outputs.
- [ ] Run `pnpm --filter @pharmassist/runtime test`; expected: supplied 50 golden inputs pass semantic safety constraints.
- [ ] Commit with `feat: build deterministic safety retrieval engine`.

### Task 4: Knowledge lifecycle and signed synthetic pack

**Files:** `packages/knowledge/src/**`, `data/synthetic/**`, `data/generated-dev-pack/**`, `tools/pack-cli/**`

- [ ] Write compiler tests for Source → Claim → Card links, A/B/C/D/X policy, conflicts, expiry, approvals, domains, placeholder/synthetic production rejection.
- [ ] Implement canonical recursive key sorting, SHA-256, Ed25519 signing/verification, immutable semantic versions, and key-id handling.
- [ ] Generate a dev key only during build, keep private material under ignored `.local`, and commit only public dev verification key plus signed artifact.
- [ ] Implement atomic stage/verify/smoke/activate, retention of three good packs, rollback, kill switch, revoke, and downgrade denial.
- [ ] Run `pnpm pack:build:dev && pnpm pack:verify && pnpm test:knowledge`; expected: signed synthetic pack passes local-demo and fails production gate.
- [ ] Commit with `feat: compile and verify signed knowledge packs`.

### Task 5: OpenAI and Realtime boundaries

**Files:** `packages/openai-adapter/src/**`, copied `prompts/**`, adapter tests, `docs/OPENAI_INTEGRATION.md`

- [ ] Verify prompt registry hashes at startup and reject drift.
- [ ] Implement `ResponsesRefiner` with `store:false`, streaming, strict `text.format`, 420 token cap, 2.5s timeout, one bounded retry outside critical path, AbortSignal, no persistent state.
- [ ] Default public GA equivalents to `gpt-5.4-mini` for fast phrasing and `gpt-5.5` for ambiguity/offline authoring; preserve env overrides and record that Luna/Terra/Sol public IDs were not verified.
- [ ] Build only redacted minimal payloads; block calls when redaction confidence is insufficient.
- [ ] Post-validate schema, identity/version, allowlist subset, red-flag/slot monotonicity, new numbers/entities, domain, stale sequence; retain instant output on every rejection.
- [ ] Implement official transcription-only session shape for `gpt-realtime-whisper`, WebRTC unified broker, event reducer keyed by item ID, stable prefix, duplicate/out-of-order/reconnect handling, and fake source.
- [ ] Run `pnpm test:openai`; expected: store/schema/timeout/abort/stale/injection/realtime cases pass without network.
- [ ] Commit with `feat: add guarded OpenAI adapters`.

### Task 6: API, RBAC, tenancy, and storage

**Files:** `apps/api/src/**`, `database/**`, `apps/api/test/**`

- [ ] Implement every `/v1` runtime/admin endpoint, request/response validation, safe errors, no-store consultation headers, immutable ETag pack delivery, live/ready distinction, and graceful shutdown.
- [ ] Add localhost-only mock identity plus production JWT/OIDC verifier interface; enforce pharmacist/reviewer/publisher/admin roles and tenant-scoped records.
- [ ] Add rate limit, CORS allowlist, CSP/security headers, CSRF origin checks, body/input bounds, and unsafe-admin no-retry behavior.
- [ ] Add PostgreSQL tables only for users/roles, source/claim/card metadata, review state, coded feedback, and content-free audit events.
- [ ] Run migrations/seed and API inject tests; expected: all endpoints validate, role/tenant violations return safe 4xx, OpenAI-down readiness is degraded.
- [ ] Commit with `feat: expose validated tenant-safe API`.

### Task 7: Pharmacist PWA and worker

**Files:** `apps/web/src/**`, `packages/ui/src/**`, `apps/web/e2e/**`

- [ ] Build worker-only engine calls with sequence-aware messages, verified pack loading, performance marks, and crash recovery.
- [ ] Build dashboard hierarchy: say now, one next question, red flags/actions, avoid, source/version; show `DEMO / 임상 사용 금지` globally.
- [ ] Implement `/`, Escape, F, Enter, 1/2/3, R, S, visible focus, ARIA live/status, non-color state labels, critical acknowledgement, and IME suppression.
- [ ] Implement explicit-consent PTT, visible mic state, release cleanup of media tracks/buffers/transcript memory, WebRTC/fake adapter, and typed fallback.
- [ ] Implement IndexedDB verified pack staging/activation and service-worker offline app shell/reload.
- [ ] Run `pnpm --filter @pharmassist/web test && pnpm test:e2e`; expected: keyboard, critical lock, offline, PTT fallback, and accessibility smoke pass.
- [ ] Commit with `feat: deliver offline pharmacist PWA`.

### Task 8: Reviewer console and authoring adapters

**Files:** `apps/reviewer/src/**`, `tools/ingest/src/**`, reviewer tests

- [ ] Implement synthetic source inventory, candidate claims/cards, locator, tier/rights/date, conflicts/diffs, deterministic lint, safety findings, impact graph, expiry.
- [ ] Enforce revise/reject/request-evidence/reviewer approvals separately; only publisher role can build/sign/publish/rollback/revoke with reason code.
- [ ] Wire all four required authoring prompts through mock extractor/reviewer adapters; model can draft but cannot mutate approval/publish states.
- [ ] Add safe import contract, path traversal/size/compression bounds, mock MFDS/HIRA fixtures, hash/change diff, and activation/license runbook.
- [ ] Run reviewer workflow E2E from draft through signed publish and rollback; expected: separation and audit assertions pass.
- [ ] Commit with `feat: add governed knowledge reviewer workflow`.

### Task 9: Observability, security, Docker, and CI

**Files:** `packages/observability/**`, `infra/**`, `compose.yaml`, `.github/workflows/**`, `scripts/security-scan.mjs`

- [ ] Implement allowlist-only event serialization that rejects arbitrary/free-text keys; capture tests prove canaries never reach logs/spans/metrics.
- [ ] Add non-root read-only API/web/reviewer Dockerfiles, Postgres health checks, dropped capabilities, and profile-safe environment validation.
- [ ] Add CI install, format/lint, typecheck, schema drift, unit/integration/E2E, build, benchmark artifact, secret/content scan, dependency audit, and CycloneDX SBOM.
- [ ] Run `pnpm test:security`, `pnpm audit --audit-level high`, SBOM generation, and `docker compose config`; record missing Docker binary if host cannot execute containers.
- [ ] Commit with `chore: harden delivery pipeline`.

### Task 10: Benchmarks, documentation, and release evidence

**Files:** `tools/benchmark/**`, `reports/**`, `docs/**`, `IMPLEMENTATION_REPORT.md`, `README.md`

- [ ] Run fixed-corpus warm/cold exact, fuzzy, stable-prefix, pack load/size/memory, worker roundtrip, browser render, and separate mock refinement benchmarks.
- [ ] Write JSON/Markdown reports with hardware, OS, Node/browser, iterations, p50/p95/p99/max, correctness, regression threshold, and release-target caveat.
- [ ] Complete architecture, threat model, privacy/data flow, knowledge authoring, OpenAI, incident/rollback, benchmark, intended-use, legal, operations, backup/restore, and production deployment docs.
- [ ] Expand traceability to one row per AC ID with exact code/test/report paths and AUTO/BENCH/MANUAL/EXTERNAL status.
- [ ] Run clean install/check/build/E2E/security/benchmark/local health and scan for TODO/FIXME/any/secrets/raw logging/synthetic production leak.
- [ ] Commit with `docs: publish verification evidence and runbooks`.

## Self-review

- Spec coverage: all 12 acceptance categories and P0–P6 tasks map to a task above.
- Placeholder scan: plan contains no implementation placeholder; synthetic source locator markers exist only as negative-test inputs.
- Type consistency: snake_case remains at supplied JSON boundaries; TypeScript adapters use generated types and explicit mapping.
- Safety: no task introduces product-specific clinical calculation or real clinical claim without an official external gate.
- Execution mode: inline execution chosen because user requested autonomous completion and no approval pause.
