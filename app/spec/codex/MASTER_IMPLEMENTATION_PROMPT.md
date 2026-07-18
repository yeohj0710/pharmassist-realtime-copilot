# MASTER IMPLEMENTATION PROMPT — 약사 실시간 복약상담 코파일럿

아래 지시를 **구현 에이전트의 첫 프롬프트로 그대로 사용**한다. 이 프롬프트가 있는 폴더 전체가 `spec/` 또는 저장소 작업 디렉터리에 제공되어 있다고 가정한다.

---

## 0. 역할과 미션

당신은 Staff-level TypeScript/Realtime/Web/API engineer이자 clinical safety, privacy, security, QA 책임자다. 이 폴더의 모든 사양·스키마·프롬프트·예시·감사표를 읽고, **로컬에서 실제 실행되는 production-grade monorepo**를 완성하라.

제품은 대한민국 약국의 면허 약사가 사용하는 실시간 복약상담 보조 도구다. 환자의 음성 또는 약사가 입력한 짧은 키워드에서, 약사가 바로 말할 문장·다음 질문·위험신호·확인 행동을 한눈에 보여준다. 이는 환자-facing 챗봇, 자동 진단기, 자동 처방기, 판매 최적화 엔진이 아니다.

핵심은 자체 모델 학습이 아니라 **OpenAI Responses + Realtime API를 안전하게 감싼 local-first wrapper**다. 매 입력마다 LLM이 처음부터 의학적으로 추론하지 않는다. 첫 유용 카드는 브라우저의 승인 knowledge pack에서 deterministic하게 꺼내고, OpenAI는 선택적 문장 보정·모호성 해소·오프라인 저작 보조만 수행한다.

구현을 중간에서 멈추거나 설계만 제시하지 마라. 코드, 테스트, Docker, 문서, 합성 seed, benchmark, CI, 보안 설정, 실행 명령을 모두 작성하고 실제로 실행 가능한 상태로 만든다.

## 1. 먼저 해야 하는 일

1. 작업 디렉터리에서 이 spec 폴더의 모든 파일을 재귀적으로 읽는다.
2. 특히 다음을 우선 읽는다.
   - `MASTER_HANDOFF.md`
   - `docs/01_PRODUCT_REQUIREMENTS.md`
   - `docs/03_SYSTEM_ARCHITECTURE.md`
   - `docs/04_DATA_MODEL_AND_SCHEMAS.md`
   - `docs/06_REALTIME_RUNTIME_AND_LATENCY.md`
   - `docs/07_SAFETY_GUARDRAILS.md`
   - `docs/09_EVALUATION_AND_GOLDEN_TESTS.md`
   - `docs/10_DEPLOYMENT_SECURITY_OBSERVABILITY.md`
   - `docs/12_API_CONTRACT.md`
   - `schemas/*.json`
   - `prompts/*.md`
   - `codex/ACCEPTANCE_CRITERIA.md`
   - `SOURCE_AUDIT.csv`
3. `docs/`, 스키마, 이 프롬프트가 충돌하면 다음 우선순위를 적용한다.
   - 임상 안전
   - 개인정보 보호
   - 현재 공식 출처와 스키마 불변조건
   - 정확성/재현성
   - 첫 카드 지연시간
   - 약사 사용성
   - 장애 복원력
   - 비용
   - 기능 수
4. 구현 시작 전에 `docs/TRACEABILITY_MATRIX.md`를 만들고 acceptance ID → 코드 package → 테스트 → 문서를 매핑한다. 구현이 진행될 때 갱신한다.
5. 외부 secret, 라이선스, 공식 데이터 접근권한이 없더라도 질문을 되돌리며 멈추지 않는다. 안전한 interface/mock/fixture를 구현하고 실제 연동 조건을 명확히 문서화한다.

## 2. 절대 제약

다음은 협상 불가능하다.

### 임상/제품

- 첫 단계는 항상 red-flag/triage다.
- blocking slot이 없으면 관련 치료·제품별 규칙·용량을 출력하지 않는다.
- 소아 mL, 용량, 최대량, 기간, 임부·수유, 금기, 상호작용, 피임약 누락 규칙은 exact product/current verified claim 없이 계산하지 않는다.
- 모델이 지식베이스 밖의 임상 사실을 생성하지 못하게 한다.
- 환자 발화나 원본 문서의 prompt injection을 실행하지 않는다.
- 진단을 확정하지 않는다.
- 약사 확인이 필요한 action을 명시한다.
- 임상 안전 점수는 재고·마진·판매액과 완전히 분리한다.
- human OTC, Rx counseling, supplement, animal, operations/marketing 도메인을 compile-time과 runtime 모두에서 분리한다. 기본 활성 도메인은 `human_otc`다.
- 첨부 원본을 runtime vector store/RAG로 직접 검색하지 않는다.
- `examples/`의 합성/placeholder 자료는 production pack에 절대 포함하지 않는다.

### 성능

- typed exact/rule의 critical path에 네트워크 호출을 넣지 않는다.
- 브라우저 Web Worker에서 local normalize → safety → retrieve → render를 수행한다.
- 제품의 “1초”는 stable input 이후 첫 유용 로컬 카드로 정의한다.
- 목표: typed exact/rule P95 ≤ 250ms, local fuzzy P95 ≤ 400ms, stable voice prefix 이후 P95 ≤ 700ms.
- LLM refinement는 비동기 업데이트이며 timeout/abort/stale-drop이 필수다.
- critical red flag는 debounce를 우회한다.

### 개인정보/보안

- 브라우저에 표준 OpenAI API key를 노출하지 않는다.
- push-to-talk가 기본이고 always-listening은 기본 false다.
- raw audio, raw transcript, 환자 자유 텍스트를 기본 저장하거나 로그하지 않는다.
- Responses 요청은 `store:false`; persistent conversations/background mode/hosted vector store는 기본 비활성이다.
- 외부 모델에는 raw transcript가 아니라 가능한 한 구조화된 slots와 최소 redacted text만 보낸다.
- PII redaction이 확실하지 않으면 refinement를 차단하고 local result를 유지한다.
- 모든 외부 입력과 모델 출력을 runtime schema로 검증한다.
- 모든 request에 UUID request/session, monotonic sequence를 사용하고 stale 결과를 폐기한다.
- secret scanning, secure headers, rate limit, RBAC, audit event minimization을 구현한다.

### 코드 품질

- TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- core에서 `any` 금지. 외부 SDK boundary의 `unknown`은 schema validation 후 좁힌다.
- deterministic core는 pure function과 dependency-injected clock/provider/store로 구현한다.
- catch-and-ignore 금지. 모든 오류는 typed code와 safe fallback을 가진다.
- completion branch에 TODO/FIXME/빈 stub/`throw new Error("not implemented")`를 남기지 않는다.
- 테스트를 통과시키기 위한 safety rule 완화 금지.

## 3. 권장 저장소 구조

`codex/REPO_TREE.md`를 기준으로 pnpm/Turborepo monorepo를 구현한다. 최소 구성은 다음과 같다.

```text
apps/
  web/          # pharmacist PWA, Web Worker, push-to-talk
  api/          # refinement, realtime broker, packs, feedback, health
  reviewer/     # source→claim→card review/publish console
packages/
  contracts/    # JSON Schema, generated TS types, validators, OpenAPI
  domain/       # value objects/invariants/error codes
  normalizer/   # Korean normalization, units, PII, negation, temporality
  safety/       # red flags, blocking slots, domain/numeric/product gates
  retrieval/    # exact/trie/rules/BM25/trigram/scoring/hysteresis
  knowledge/    # registries, lint, compiler, signature, update/rollback
  openai-adapter/ # Responses + Realtime adapters, mock, post-validator
  observability/  # content-free audit/metrics/log redaction
  ui/             # accessible presentational components
  test-fixtures/  # synthetic-only packs/events/audio metadata
services-or-tools/
  ingest/         # inventory/extraction adapter skeleton
  pack-cli/       # lint/build/sign/verify/publish/rollback
  benchmark/      # deterministic latency harness
infra/
  docker/
  compose/
  ci/
docs/
tests/
```

Node.js의 현재 active LTS와 각 dependency의 현재 안정 버전을 구현 시점에 확인하고 lockfile로 고정한다. 라이브러리 API가 spec 작성 시점과 다르면 공식 문서를 기준으로 adapter 내부만 수정하고 제품 불변조건은 유지한다.

## 4. 구현 상세

### 4.1 Contracts와 스키마

- 제공된 `schemas/*.json`을 source of truth로 복사/참조한다.
- Ajv 또는 동등한 JSON Schema 2020-12 validator를 사용한다.
- TypeScript 타입을 생성하되 handwritten duplicate type가 drift하지 않게 한다.
- extractor/reviewer/pack manifest/feedback/refinement envelope용 추가 schema를 작성한다.
- OpenAPI 3.1을 생성하고 `/docs` 또는 파일로 제공한다.
- schema examples, API responses, model outputs를 CI에서 모두 검증한다.
- UUID/date-time format validator를 활성화한다.

### 4.2 Korean local engine

한 package의 동일 함수를 Web Worker와 API 서버가 공유하게 한다.

Normalizer:
- Unicode NFKC, CR/LF/공백 정리, case/ASCII variants
- 한국어 IME composition 상태 존중
- 숫자·한국어 수 표현, 나이/체중/시간/기간/mg/g/mL/cc/정/포/회 정규화
- 제품/성분 alias와 ASR confusion alternatives
- 전화번호, 이메일, 주민등록번호 패턴 등 PII 탐지/마스킹
- 부정어 scope: `없다`, `안`, `아니다`, `없었음`, `괜찮다` 등
- 현재/과거/가능성/가족의 증상을 구별할 수 있는 conservative temporality/person scope
- 교정이 불확실하면 원문을 덮지 말고 alternatives를 유지

Slot extractor:
- age/age group, weight, pregnancy possibility/weeks, lactation
- symptom/body site/duration/severity
- allergy, conditions, current meds
- product/ingredient/concentration/form/route
- missed count/time/pack position
- positive/negative red-flag evidence
- 모든 slot에 provenance, confidence, verified 여부

Safety gate 순서:
1. critical red flags
2. current patient/person scope와 negation
3. domain mismatch
4. allergy/contraindication hard-block hooks
5. blocking slots
6. exact product/concentration identity
7. card/claim approval, expiry, revocation, source tier
8. numeric output gate

Retrieval:
- normalized exact alias map
- multi-token trie/Aho-Corasick 또는 검증된 동등 구현
- deterministic conditions/rules
- compact BM25. 한국어는 whitespace token과 character bi/tri-gram을 조합해 형태소 분석기에 의존하지 않는 baseline을 만든다.
- optional trigram fuzzy candidate
- score와 safety는 분리. safety는 ranking으로 상쇄될 수 없다.
- top candidate 및 설명 가능한 match features를 반환한다.
- hysteresis/margin/freeze/sequence를 구현한다.

### 4.3 Knowledge pack

- SourceRecord → Claim → ConsultationCard → compiled pack state machine을 구현한다.
- draft, review, approved, published, stale, revoked 상태를 명시한다.
- trust policy A/B/C/D/X를 compile gate로 강제한다.
- source audit의 `C-D` 혼합 표기는 저장 enum이 아니다. claim별 C/D로 분해하고 불가능하면 D로 취급한다.
- published 카드의 claim/source는 A/B, current, locator 있음, 검수자/검증일/만료일 있음이어야 한다.
- C는 workflow/wording candidate만, D는 metadata/vocabulary만, X는 runtime exclusion이다.
- conflict가 있으면 publish 실패다.
- 사람/동물/건기식 domain leak를 build-time과 runtime에서 모두 실패시킨다.
- 카드/claim/source/product index와 alias/rule/BM25 index를 precompile한다.
- canonical JSON + SHA-256 + Ed25519 서명/검증을 구현한다.
- 브라우저는 manifest/schema/signature/smoke test 후 IndexedDB에 새 pack을 저장하고 원자적으로 활성화한다.
- 최근 정상 pack 2개 이상을 보관하고 rollback/kill switch/revocation을 지원한다.
- private signing key는 repo/브라우저에 넣지 않는다.
- synthetic marker, placeholder locator, 미승인/만료 source가 있으면 production build를 실패시킨다.

### 4.4 Web PWA

UI 우선순위:
1. 지금 말할 문장
2. 다음 질문 하나
3. 위험 신호/의뢰
4. 확인된 행동/주의
5. 피할 표현
6. 출처/검증일/knowledge version

필수 동작:
- 키보드 중심: `/` 입력 focus, `Esc`는 열린 modal/cancel에만 사용하고 상담 전체를 초기화하지 않음, `F` freeze, `Enter` selected action confirm, 접근 가능한 PTT shortcut
- IME composition 중 검색 금지
- provisional/stable/blocked/final 상태를 색상 이외의 텍스트/아이콘으로 구분
- critical card가 고정되고 확인 전 다른 결과가 덮지 못함
- freeze 후 자동 카드 교체 금지, slot은 명시적으로 갱신 가능
- network/OpenAI 실패 badge가 local card를 가리지 않음
- 상세 근거는 펼침 패널. 첫 화면에 장문/모델 추론 없음
- mic 상태/녹음 고지/동의 UI, PTT release 후 audio track stop
- offline install/reload, service worker cache, accessible focus/ARIA/contrast
- 합성 데이터로 동작할 때 화면 전체에 “DEMO / 임상 사용 금지” 표시

Web Worker:
- pack load/verify/index
- normalize/safety/retrieve
- monotonically sequenced messages
- worker crash recovery
- performance marks

### 4.5 API

Fastify 또는 동등한 경량 TypeScript 서버로 `docs/12_API_CONTRACT.md`를 구현한다.

필수 endpoints:
- `POST /v1/consult/instant`
- `POST /v1/consult/refine` (SSE)
- `POST /v1/realtime/session`
- `GET /v1/knowledge/manifest`
- `GET /v1/knowledge/packs/:version`
- `POST /v1/feedback`
- `GET /v1/health/live`
- `GET /v1/health/ready`
- reviewer/admin source/claim/card/review/build/publish/rollback/revocation endpoints

요구사항:
- request validation, response validation, safe error envelope
- auth interface + local development mock identity + production OIDC/JWT validation hook
- roles: pharmacist, reviewer, publisher, admin; least privilege
- tenant isolation
- rate limit/CSRF/CORS/CSP/security headers per deployment profile
- consultation response `Cache-Control: no-store`
- pack immutable/ETag caching
- raw text를 headers, access logs, traces에 넣지 않음
- readiness에서 OpenAI 장애는 typed local core를 `degraded`로만 표시

### 4.6 OpenAI Responses adapter

공식 OpenAI SDK와 구현 시점의 최신 공식 문서를 사용하되 interface 뒤에 격리한다.

- 모델 ID는 config: default `gpt-5.6-luna`, ambiguity `gpt-5.6-terra`, offline authoring `gpt-5.6-sol` 또는 조직에서 검증한 동등 모델
- reasoning default `none`, ambiguity `low`
- `store:false`
- streaming
- strict Structured Outputs는 `runtime_output.schema.json`을 사용
- 짧은 output/token limit
- timeout 기본 2.5초, retry 최대 1회이며 UI critical path 밖
- AbortController로 이전 sequence 취소
- system/developer prompt는 `prompts/` registry에서 버전/해시로 로드
- payload는 minimal redacted text + structured slots + allowed cards/claims만
- patient/source content는 untrusted data로 delimiter/JSON field 분리
- output post-validation:
  - schema
  - same request/session/sequence/knowledge version
  - source/claim allowlist subset
  - red-flag monotonicity
  - blocking-slot monotonicity
  - unsupported number/entity/brand/ingredient detector
  - domain isolation
- 실패 시 local instant output 유지
- request/response body를 로그하지 않음
- mock provider와 deterministic fixtures 제공
- integration test에서 `store:false`, schema, timeout, stale-drop을 assert

OpenAI API shape가 변경된 경우 공식 문서에 맞추되 adapter contract tests와 위 불변조건을 유지한다. 확인하지 못한 endpoint/field를 지어내지 않는다.

### 4.7 OpenAI Realtime transcription adapter

- browser media에는 WebRTC를 사용한다.
- standard API key는 서버에만 둔다.
- 서버가 short-lived session/unified call broker를 제공한다.
- transcription model은 config default `gpt-realtime-whisper`; 현재 공식 지원 모델/이벤트를 구현 시 확인한다.
- 한국어 language hint와 active-domain의 짧은 approved vocabulary만 보낸다.
- transcript delta/final event reducer, reconnection, duplicate/out-of-order event handling
- stable-prefix detector와 partial red-flag path
- ASR alternatives/uncertainty를 보존
- raw audio는 앱 서버/DB/log에 저장하지 않는다.
- 브라우저 PTT가 끝나면 media track/buffer를 중단·삭제한다.
- Realtime 실패 시 typed input으로 즉시 fallback한다.
- official API가 없거나 secret이 없는 test 환경에서는 fake WebRTC/transcript event source로 E2E를 완성한다.

전체 음성 에이전트가 직접 환자에게 답하는 기능은 기본 구현/활성화하지 않는다.

### 4.8 Reviewer/authoring app

Reviewer console은 합성 자료로 완전 동작해야 한다.

- source inventory/import metadata
- candidate claim/card import
- source locator/minimal context
- source tier/domain/rights/date
- official verification source 연결
- conflict view and diff
- deterministic lint findings
- safety reviewer findings
- revise/reject/request evidence/approve actions
- pharmacist approval과 medical safety approval 분리
- expiry 설정
- impact graph: claim 변경 시 영향 카드/테스트
- build/sign/publish/rollback은 별도 publisher role
- 모든 변경에 content-free audit metadata와 reason code
- 모델은 draft를 만들 수 있지만 approve/publish 버튼을 실행할 권한이 없음

`prompts/offline_card_extractor_prompt.md`, `source_conflict_resolver_prompt.md`, `safety_reviewer_prompt.md`, `pharmacist_review_prompt.md`를 registry로 연결한다. raw source가 없을 때도 mock extractor로 전체 workflow를 시연한다.

### 4.9 Storage

로컬 개발 기본:
- PostgreSQL Docker service: authoring metadata, users/roles, coded audit/feedback
- file/object storage adapter: signed knowledge packs; dev는 local filesystem
- PWA IndexedDB: verified pack and ephemeral session state

금지:
- patient profile DB
- raw audio/transcript table
- general prompt/response log table
- production source raw files in Git

DB migration, seed, backup/restore procedure를 제공한다. `source_materials/`, `.env*`, signing private keys는 `.gitignore`와 secret scan에 포함한다.

### 4.10 Observability

- Pino/structured log에 content-free fields만
- OpenTelemetry spans with IDs/latency/error code, no patient text
- metrics:
  - instant latency stages
  - voice stable-prefix latency
  - refinement latency/error/rejection
  - intent/card/knowledge/model version aggregate
  - accept/edit/reject/escalate reason codes
  - pack update/rollback/revocation
- dashboards/alerts는 sample config 또는 documented queries로 제공
- automated test가 transcript/query가 logs/spans에 없는지 검사

## 5. 합성 지식팩과 데이터 정책

제공된 `examples/`는 동작/스키마 시연용이다. 실제 의학적 정확성을 주장하지 않는다.

- sample cards/golden cases를 synthetic dev pack으로 변환한다.
- UI와 pack manifest에 `synthetic=true`, `clinical_use_prohibited=true`를 강제한다.
- production profile에서 synthetic/placeholder/unapproved/expired card를 발견하면 프로세스 또는 pack build를 fail closed한다.
- 실제 첨부 파일이나 장문 원문을 repo에 복사하지 않는다.
- `SOURCE_AUDIT.csv`는 정책/추적 reference로만 둔다.
- 공식 MFDS/HIRA integration은 이용조건이 확인되지 않은 자동 scraper로 구현하지 않는다. adapter와 import contract, fixture, validation, change-diff를 구현하고 실제 credential/licensing step을 문서화한다.

## 6. 테스트 요구사항

`codex/ACCEPTANCE_CRITERIA.md`의 모든 항목을 자동 또는 명시적 manual gate로 구현한다.

최소 자동 테스트:

### Unit/property
- Korean normalization/units/IME
- PII redaction and fail-closed
- negation/person/temporality
- slots and validators
- red flags preemption
- blocking/numeric/product/domain gates
- exact/trie/BM25/fuzzy/scoring
- hysteresis/freeze/sequence race
- schema validators and error envelopes
- pack compile/sign/verify/rollback/revoke
- model allowlist/post-validator

### Golden/adversarial
- 제공된 50 synthetic cases
- critical red flags, negated red flags, past/family statements
- missing pediatric/product/concentration inputs
- pregnancy/lactation uncertainty
- duplicate ingredient hooks
- pill missed-dose ambiguity
- domain leaks
- prompt injection in patient/source text
- unsupported numeric fact injected by model
- stale model stream after newer input
- PII in attempted logs/payload
- expired/revoked/conflicted pack

### Integration/E2E
- typed offline flow with no API key/network
- OpenAI mock refinement success/schema failure/timeout/stale
- fake Realtime partial/final/reconnect/failure
- PWA offline reload and pack update
- reviewer draft→review→build→sign→publish→rollback
- role/tenant authorization
- API response validation
- accessibility smoke with keyboard-only path

### Performance
- deterministic corpus warm/cold benchmark
- exact/rule P50/P95/P99
- fuzzy P50/P95/P99
- worker message + render time
- voice event replay from stable prefix
- pack startup/load/memory size
- refinement measured separately
- CI는 환경 변동을 고려해 correctness gate와 regression threshold를 분리하되 결과 JSON/Markdown을 artifact로 남긴다.

테스트는 외부 OpenAI 호출 없이 기본 통과해야 한다. live integration은 opt-in env flag로 분리한다.

## 7. 개발·배포 산출물

반드시 생성한다.

- root `README.md` with one-command local setup
- `.env.example` without secrets
- `docker-compose.yml` 또는 `compose.yaml`
- DB migrations/seeds
- OpenAPI 3.1
- generated schema docs/types
- PWA/web/api/reviewer implementation
- synthetic dev pack compiler and signed dev pack
- CLI: lint/build/sign/verify/benchmark
- CI workflow: install, lint, typecheck, schema, tests, build, E2E, security, SBOM
- Dockerfiles with non-root runtime
- production config/reference deployment guide
- `docs/ARCHITECTURE.md`
- `docs/THREAT_MODEL.md`
- `docs/PRIVACY_AND_DATA_FLOW.md`
- `docs/KNOWLEDGE_AUTHORING.md`
- `docs/OPENAI_INTEGRATION.md`
- `docs/INCIDENT_AND_ROLLBACK.md`
- `docs/BENCHMARKS.md`
- `docs/INTENDED_USE_AND_LIMITATIONS.md`
- `docs/LEGAL_REVIEW_CHECKLIST.md`
- `docs/TRACEABILITY_MATRIX.md`
- `IMPLEMENTATION_REPORT.md`

Deployment profiles:
- `local-demo`: synthetic pack, mock OpenAI possible
- `local-live`: local API + real OpenAI secrets, no production claim
- `staging`: auth/telemetry/pack signing enabled
- `production`: synthetic forbidden, official pack/reviewer/legal gates required

## 8. 완료 판정과 작업 방식

다음 작업 방식을 지켜라.

1. 각 phase를 구현하고 그 phase의 tests를 실행한다.
2. 실패를 숨기거나 test를 skip하여 green으로 만들지 않는다.
3. 새로운 선택지가 생기면 안전 우선순위로 결정하고 `docs/DECISIONS.md`에 기록한다.
4. secret/license/실제 official dataset만 없어서 live 연동이 불가능한 경우 interface/mock을 완성하고 정확한 활성화 단계와 미검증 부분을 보고한다.
5. 현재 공식 OpenAI API 문서와 SDK를 확인하고 링크/검증일을 `docs/OPENAI_INTEGRATION.md`에 기록한다. 원문을 길게 복제하지 않는다.
6. 모든 commands를 실제 실행한다. 결과를 `IMPLEMENTATION_REPORT.md`에 명령, pass/fail, 성능, 잔여 external gate로 남긴다.
7. `grep`/lint로 TODO/FIXME, hardcoded secret, standard API key in client, raw transcript logging, synthetic production leak를 검사한다.
8. 최종 답변 전에 `codex/ACCEPTANCE_CRITERIA.md`를 항목별로 체크하고 증거 경로를 연결한다.

## 9. 최종 응답 형식

최종 응답에는 장황한 설계 반복 대신 다음을 정확히 보고한다.

1. 구현된 앱/패키지 요약
2. 로컬 실행 명령
3. 자동 테스트/benchmark 결과
4. OpenAI live 연결 방법과 필요한 env
5. production knowledge pack을 만들기 위해 남은 **외부 승인/공식 데이터/법률 gate**
6. acceptance criteria evidence 위치
7. 알려진 한계와 fail-safe 동작

“완료”라고 말하려면 source code, tests, build, local demo가 실제로 동작해야 한다. 실제 공식 의약품 데이터나 법률 승인이 없으면 임상 production-ready라고 주장하지 말고, 애플리케이션 구현 완료와 임상 데이터/규제 승인 미완료를 명확히 분리하라.
