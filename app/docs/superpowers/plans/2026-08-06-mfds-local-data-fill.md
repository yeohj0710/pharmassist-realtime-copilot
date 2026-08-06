# MFDS Local Dataset Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 식약처 공식 API 4종의 원문을 `C:\dev\kr-drug-data`에 보존하고, 로컬 리더만 사용해 PharmAssist와 두 연결 프로젝트의 후보 데이터를 갱신한다.

**Architecture:** 수집기는 API 페이지를 순차 요청하고 원문 응답은 메모리 해시 계산 뒤 폐기한다. 공유 저장소에는 `fields` 원문과 조회 식별자만 JSONL로 저장하며, PharmAssist는 공유 저장소를 직접 읽어 적응증 보강·성분 등록·DUR 후보·크로스워크 후보·차이 표를 생성한다. 운영 팩에는 사람이 승인하지 않은 DUR·크로스워크 판단을 승격하지 않는다.

**Tech Stack:** Node.js 24, TypeScript/tsx, pnpm, JSONL, SHA-256, Vitest, PowerShell, 기존 PharmAssist pack 생성기.

---

### Task 1: 공유 MFDS 수집기와 저장 계약

**Files:**
- Modify: `C:\dev\pharmassist-realtime-copilot\app\tools\ingest\src\index.ts`
- Create: `C:\dev\pharmassist-realtime-copilot\app\scripts\sync-mfds-local-datasets.ts`
- Modify: `C:\dev\pharmassist-realtime-copilot\app\package.json`
- Test: `C:\dev\pharmassist-realtime-copilot\app\tools\ingest\src\index.test.ts`
- Output: `C:\dev\kr-drug-data\permit\`, `C:\dev\kr-drug-data\dur-product\`, `C:\dev\kr-drug-data\dur-ingredient\`

- [ ] **Step 1: Keep the source contract explicit.** `MfdsPagedAdapter.fetchPages()` exposes `pageNo`, `totalCount`, and parsed `items`; it updates a SHA-256 digest using the existing `\n--PAGE--\n` delimiter and returns a complete `SourceSnapshot` without retaining page bodies.
- [ ] **Step 2: Stream normalized JSONL.** `sync-mfds-local-datasets.ts` uses `createMfDsAdapterFromEnv`, `normalizeMfDsCandidate`, `FileHandle.write`, and a temporary file per catalog. It writes `permit/catalog.jsonl`, `dur-product/catalog.jsonl`, and the seven named files under `dur-ingredient/`, then atomically renames each file and manifest.
- [ ] **Step 3: Preserve the raw-field rule.** Every output row keeps the API object unchanged under `fields`, exposes `itemSeq` or `ingredientCode` above it, and keeps `candidateOnly: true`. The script never writes the raw HTTP body or service key.
- [ ] **Step 4: Record manifests.** Each directory manifest and `C:\dev\kr-drug-data\manifest.json` records URL, fetch time, terms URL, HTTP status, content SHA-256, parser version, record count, and page count. A failed dataset leaves the active root manifest pending.
- [ ] **Step 5: Verify.** Run `corepack pnpm typecheck`, `corepack pnpm --filter @pharmassist/ingest test`, then the full `corepack pnpm data:sync:mfds-local`. Confirm every JSONL line parses, each catalog hash matches its manifest, and no output contains `ServiceKey=`.

### Task 2: Local reader and official text overlays

**Files:**
- Create: `C:\dev\pharmassist-realtime-copilot\app\scripts\lib\kr-drug-data-reader.mjs`
- Modify: `C:\dev\pharmassist-realtime-copilot\app\scripts\build-actual-preview-pack.mjs`
- Create: `C:\dev\pharmassist-realtime-copilot\app\scripts\build-mfds-derived-candidates.mjs`
- Test: `C:\dev\pharmassist-realtime-copilot\app\tests\data\kr-drug-data-reader.test.ts`
- Output: `C:\dev\pharmassist-realtime-copilot\app\data\actual-candidate-pack\mfds-derived-candidates.json`

- [ ] **Step 1: Add a thin reader.** `kr-drug-data-reader.mjs` resolves `KR_DRUG_DATA_DIR` or `C:\dev\kr-drug-data`, exposes an async JSONL iterator, and reads only the requested catalog. It must not copy a source catalog into the PharmAssist repository.
- [ ] **Step 2: Join by `itemSeq`.** The derived builder indexes e약은요 and permit rows by `itemSeq`; product-name matching is prohibited. It records the selected source row and locator in the derived candidate output.
- [ ] **Step 3: Fill only empty indications.** For products whose `indication_summary` is absent or empty, use the official e약은요 `fields.efcyQesitm` unchanged. If it is unavailable, use the permit `fields.EE_DOC_DATA` unchanged. Do not summarize, translate, compact, or overwrite a non-empty indication.
- [ ] **Step 4: Register only traceable ingredients.** Parse permit `MATERIAL_NAME` and DUR ingredient identifiers to map missing ingredient IDs to an official Korean name. If no exact official name exists, emit the ID in a skipped list with a reason and do not invent a value.
- [ ] **Step 5: Verify.** Assert all overlay joins use `itemSeq`, every filled indication has an official source reference, and no generated field contains the prohibited card keys `choose_when`, `comparison_note`, or `differentiators`.

### Task 3: DUR candidate and crosswalk outputs

**Files:**
- Modify: `C:\dev\pharmassist-realtime-copilot\app\scripts\build-mfds-derived-candidates.mjs`
- Create: `C:\dev\pharmassist-realtime-copilot\app\data\actual-candidate-pack\dur-candidates.json`
- Create: `C:\dev\pharmassist-realtime-copilot\app\data\actual-candidate-pack\permit-crosswalk-candidates.json`
- Create: `C:\dev\pharmassist-realtime-copilot\app\data\actual-candidate-pack\permit-difference-table.json`
- Modify: `C:\dev\kr-drug-data\README.md`

- [ ] **Step 1: Keep DUR provisional.** Join the seven DUR ingredient catalogs by ingredient code and the DUR product catalog by `itemSeq`. Store type, source snapshot ID, raw field locator, and candidate status in `dur-candidates.json`; do not convert candidates into production blocking rules or change `clinicalUseProhibited`.
- [ ] **Step 2: Build crosswalk candidates only.** For the 21 failed legacy rows and their 38 matching item-seq pairs, compare manufacturer, active composition, dosage form, and permit number. Write evidence and unresolved conflicts to `permit-crosswalk-candidates.json`; leave `official_match_status` unchanged.
- [ ] **Step 3: Build a table, not prose.** For products sharing a clinical pathway, write rows containing item sequence, product name, ingredient, strength, dosage form, and official indication text. Do not generate explanatory sentences.
- [ ] **Step 4: Update the shared README.** Add one line each for `pharmassist-realtime-copilot`, `offlabel-pool`, and `otc-nutrient-safety-engine`, describing that each reads `C:\dev\kr-drug-data` through a local reader.
- [ ] **Step 5: Verify.** Assert no candidate output sets `verified`, `published`, or `pharmacist_reviewed` to true, no candidate clears `clinicalUseProhibited`, and all crosswalk status fields remain human-decision states.

### Task 4: Thin readers for connected projects

**Files:**
- Create or modify: `C:\dev\offlabel-pool\tools\kr-drug-data-reader.mjs`
- Create or modify: `C:\dev\otc-nutrient-safety-engine\src\lib\kr-drug-data-reader.ts`
- Modify: each project’s existing local source entrypoint only where required
- Test: each project’s existing test location

- [ ] **Step 1: Read each project’s current data entrypoint.** Keep `offlabel-pool` focused on permit original-text comparison and keep OTC v5.0/v5.1 protected trees read-only.
- [ ] **Step 2: Add a path-configurable reader.** Default to `C:\dev\kr-drug-data`; allow an environment override for tests; expose permit and DUR records without duplicating catalogs.
- [ ] **Step 3: Preserve project boundaries.** Do not import PharmAssist pack JSON, do not write into `research_v3/`, do not activate v5.1 candidates, and do not deploy the OTC project.
- [ ] **Step 4: Verify.** Run `node build.mjs` in `C:\dev\offlabel-pool` and the OTC project’s required `pytest`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` checks after the reader is connected.

### Task 5: PharmAssist pack gates and handoff

**Files:**
- Modify only the generation pipeline files selected by Tasks 2–3
- Preserve: `C:\dev\pharmassist-realtime-copilot\app\data\actual-candidate-pack\pack.json` as generated output
- Preserve: existing user changes in all three Git worktrees

- [ ] **Step 1: Run the generation gate.** `corepack pnpm data:build:pack` must consume only local files and produce the derived candidate outputs and generated pack.
- [ ] **Step 2: Check the fixed baseline.** Confirm tests remain 452, claims 483, protocols 44, and options 337. Stop if any count changes without an explicit source-backed reason.
- [ ] **Step 3: Run all required checks.** Run `corepack pnpm build`, `corepack pnpm test`, `corepack pnpm typecheck`, and `corepack pnpm schema:check`. Do not weaken a guard to make a failure disappear.
- [ ] **Step 4: Check review debt.** Confirm the pharmacist queue stays at or below 250; the current queue is 179. If the queue increases past 250, stop and report.
- [ ] **Step 5: Commit and deploy only after green gates.** Commit and push only the intended files when all gates pass. If the generated pack changed, run `corepack pnpm deploy:web`; otherwise do not deploy. Never print or commit any service key.

### Task 6: Reporting and cleanup

**Files:**
- Create: `C:\dev\kr-drug-data\etc\logs\state.json`
- Create: `C:\dev\kr-drug-data\etc\logs\known_items.txt`
- Create: `C:\dev\kr-drug-data\etc\logs\run-report.md`

- [ ] **Step 1: Checkpoint collection state.** Record dataset, page, record counters, completed IDs, retry count, last error, and next action after each short batch.
- [ ] **Step 2: Record required samples.** Keep ten item-seq samples per work unit for direct human inspection, with source snapshot IDs and local file paths.
- [ ] **Step 3: Report each unit.** Include processed/succeeded/failed/skipped counts, newly filled fields, top three failure reasons, ten samples, gate results, commit hash, and next action.
- [ ] **Step 4: Remove only agent-created disposable artifacts.** Keep final catalogs, manifests, derived candidates, and required logs. Move or remove stale partial catalogs after verifying they are not active outputs; do not touch pre-existing user files.
