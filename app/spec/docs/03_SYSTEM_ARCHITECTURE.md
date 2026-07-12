# 03. System Architecture

## 1. 아키텍처 원칙

- **Local first:** 첫 카드는 브라우저 안에서 계산한다.
- **Deterministic before generative:** 안전·슬롯·검색이 LLM보다 앞선다.
- **Compiled knowledge:** 원본 문서를 런타임에서 읽지 않고 승인 카드를 compact pack으로 빌드한다.
- **Stateless external inference:** 외부 모델에는 최소한의 구조화 컨텍스트만 보내고 장기 상태를 만들지 않는다.
- **Graceful degradation:** OpenAI·네트워크 장애 시 typed core는 남는다.
- **Human-in-the-loop:** 약사의 선택/freeze/승인이 모델보다 우선한다.
- **Source traceability:** 모든 운영 문구를 claim/source/version으로 역추적한다.

## 2. 권장 기술 스택

### Monorepo

- Node.js 22 LTS 이상
- pnpm workspaces + Turborepo
- TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### Web

- React + Vite PWA
- Web Worker에서 normalize/safety/retrieval
- Service Worker로 앱과 서명된 knowledge pack 캐시
- TanStack Query 또는 얇은 자체 fetch layer
- 접근성 있는 headless UI primitives

SSR은 필요하지 않으므로 Next.js보다 가벼운 PWA 구성이 적합하다. 약국 로컬 설치가 필요하면 동일 웹 앱을 Tauri로 감싸는 것은 이후 선택사항이다.

### API

- Fastify
- JSON Schema/Ajv를 단일 계약으로 사용
- OpenAI 공식 JavaScript SDK
- SSE for Responses refinement
- Realtime WebRTC session broker 또는 unified interface endpoint
- Pino structured logging + OpenTelemetry

### Storage

- 로컬/단일 약국: SQLite + FTS5, immutable JSON pack
- 중앙 저작/다기관: PostgreSQL + optional pgvector
- Redis는 v1 필수 아님; rate limit/ephemeral coordination이 필요할 때만
- 객체 저장소에는 승인된 pack만; 원본 환자 오디오/전사는 저장 금지

### Tests

- Vitest unit/integration
- Playwright E2E
- `autocannon` 또는 k6 benchmark
- JSON Schema validation
- property-based tests for normalizer/negation/sequence handling

## 3. 런타임 컴포넌트

### 3.1 Input Controller

타이핑, push-to-talk, slot chip, 카드 선택을 동일한 `RuntimeInput` 이벤트로 변환한다. 각 이벤트는 `session_id`, 단조 증가 `sequence`, `request_id`를 가진다.

### 3.2 Realtime Transcription Adapter

- 브라우저는 WebRTC를 사용한다.
- 표준 API key는 서버에만 둔다.
- gpt-realtime-whisper의 transcript delta를 수신한다.
- 한국어로 설정하고 실제 약국 소음/마스크/노년층/제품명 발화를 평가한다.
- ASR 불확실성이 높으면 대안 토큰을 유지해 UI에 확인 질문을 만든다.
- raw audio를 앱 서버를 경유시키지 않는 구조를 우선한다.

### 3.3 Normalizer

순수 함수로 구현하고 Web Worker와 서버에서 동일 코드를 공유한다.

- Unicode NFKC
- 한국어 IME composition 완료 이벤트 처리
- 숫자/단위 정규화: 세, 살, kg, 킬로, mL, 씨씨 등
- 띄어쓰기 변형과 흔한 오타
- 제품/성분 alias
- 약국 환경 ASR confusion map
- PII 탐지/마스킹
- 부정어 scope: `없다`, `안`, `아니다`, `없었어요` 등
- temporal phrase: 오늘, 어제, 며칠, 주째
- 불확실한 교정은 하나로 덮어쓰지 않고 alternatives로 남김

### 3.4 Slot Extractor

정규식·사전·작은 상태 머신으로 다음을 추출한다.

- 나이/연령군/소아 여부
- 체중
- 임신/임신 가능성/주수/수유
- 증상·부위·기간·정도
- 알레르기
- 현재 의약품/질환
- 제품명·성분·농도·제형
- 놓친 복용 횟수/시점/포장 위치
- red-flag 관련 양성/음성 표현

모델 추출을 보조로 쓸 수 있지만, 필수 안전 슬롯은 deterministic validator가 최종 판정한다.

### 3.5 Safety Gate

검색 전에 실행한다.

1. critical red flags
2. domain mismatch
3. contraindication/allergy hard blocks
4. mandatory slot check
5. product identity/concentration check
6. source/card status and expiry check

critical match는 debounce·confidence threshold를 건너뛰고 즉시 `escalate`를 반환한다. negation-aware matcher가 필수다.

### 3.6 Retrieval Engine

knowledge pack은 시작 시 메모리에 올린다.

- `Map<normalizedAlias, CardId[]>`
- Aho-Corasick/radix trie for multi-token patterns
- condition tree/rules
- compact BM25/FTS index
- optional character trigram similarity
- card prior and domain filters

예시 점수:

```text
score = exact*1.0 + rule*0.9 + bm25_norm*0.55 + slot_fit*0.35
        + verified_product_match*0.25 - missing_blocking_slot*0.5
        - negative_pattern*1.0 - wrong_domain*infinity
```

점수 숫자는 gold set으로 보정하되, critical safety는 점수 모델과 분리한다.

### 3.7 Stability/Hysteresis Controller

부분 전사 때 화면이 흔들리지 않도록 다음 규칙을 둔다.

- 80~120ms 안정화 debounce
- exact critical red flag는 즉시
- 새 카드가 기존 카드보다 최소 margin 이상 높을 때만 교체
- 같은 intent의 slot update는 카드 내용을 갱신하되 위치 유지
- 약사가 freeze하면 자동 교체 금지
- 새 `sequence`가 오면 이전 LLM 요청 abort
- 완료된 응답의 sequence가 현재와 다르면 폐기

### 3.8 Instant Card Renderer

로컬 결과를 1~2문장과 다음 질문으로 즉시 표시한다. 근거 상세나 긴 설명을 기다리지 않는다.

### 3.9 Refinement Orchestrator

다음 상황에서만 호출한다.

- 상위 intent 점수가 근접
- 약사가 `문장 다듬기` 요청
- 여러 카드의 승인된 문구를 하나로 압축
- 환자 표현 수준에 맞는 짧은 설명 필요

외부로 보내는 값은 raw transcript가 아니라 가능한 한 다음으로 제한한다.

- redacted normalized query
- structured slots
- top card IDs와 승인된 문구/claim만
- 금지사항과 출력 schema
- knowledge version/sequence

Responses API는 `store:false`, streaming, strict JSON Schema, 짧은 max output, timeout을 사용한다. 모델은 새로운 의학 사실을 만들 수 없고, 제공된 verified claims 밖의 내용을 출력하면 결과를 폐기한다.

### 3.10 Knowledge Pack Manager

- pack manifest, semantic version, SHA-256, signature
- source/claim/card schema version
- 최소 앱 버전
- 생성·승인·만료 시각
- 이전 버전 목록
- 다운로드 후 signature/schema/golden smoke test
- 성공 후 원자적 활성화
- 실패 시 기존 pack 유지

### 3.11 Audit/Telemetry

저장 허용 예:

- tenant/pharmacist pseudonym
- event type
- intent/card/rule IDs
- latency breakdown
- accept/override code
- knowledge/model version
- 오류 코드

저장 금지 기본값:

- 환자 이름/연락처
- raw audio
- raw transcript
- 자유 텍스트 상담 내용
- 약사의 화면 캡처

## 4. 오프라인 저작 아키텍처

원본은 운영 서버와 분리된 승인된 저작 환경에서 처리한다.

```text
source inventory → extraction → candidate claims/cards → deterministic lint
→ official-source verification → pharmacist review → compile → test → sign → publish
```

GPT-5.6 Sol은 후보 구조화·충돌 탐색에 사용하지만 publish 권한은 없다. 약사 reviewer와 CI gate만 publish 상태를 만든다.

## 5. OpenAI 통합 경계

### Realtime

브라우저/모바일의 실시간 오디오는 WebRTC를 사용한다. server-side media pipeline일 때만 WebSocket을 사용한다. 세션 생성 요청에는 privacy-preserving safety identifier를 넣는다.

### Responses

- direct Responses API, Agents 프레임워크는 필수 아님
- `store:false`
- `text.format` JSON Schema strict
- streaming
- reasoning `none` 또는 `low`
- 2.5초 timeout; retry는 최대 1회, 화면 critical path와 분리
- background mode, persistent Conversations, hosted vector store는 기본 비활성

### File search

첨부 원본 전체를 hosted file search에 넣어 카운터에서 매번 찾는 구조는 사용하지 않는다. 지연·최신성·권리·출처 우선순위·의료 안전을 통제하기 어렵다. 관리자 검수 검색에서만 선택적으로 사용할 수 있다.

## 6. 장애 시나리오

| 장애 | 동작 |
|---|---|
| OpenAI Responses timeout | 로컬 카드 유지, `보정 불가` 작은 배지 |
| Realtime 연결 실패 | push-to-talk 비활성, 타이핑 자동 포커스 |
| knowledge pack 다운로드 실패 | 현재 검증 버전 유지 |
| pack 만료 | 고위험 카드 차단, 일반 문구/의뢰만 |
| schema-invalid model output | 폐기, 로컬 카드 유지, coded error |
| ASR 불확실 | 대안 단어와 확인 질문 표시 |
| 서버 전체 장애 | PWA cached core와 typed local engine 유지 |
| 잘못된 카드 배포 | kill switch 또는 이전 pack rollback |

## 7. 멀티테넌시

- 테넌트별 지식/제품/재고 메타데이터는 분리한다.
- 임상 core pack은 중앙 승인 버전, 약국별 overlay는 비임상 메타데이터만 허용한다.
- 약국별 제품 우선순위가 clinical safety score를 바꾸지 못하게 한다.
- tenant ID가 외부 모델 prompt에 불필요하게 포함되지 않도록 한다.

## 8. 관련 다이어그램

- `architecture/component_diagram.mmd`
- `architecture/sequence_diagram.mmd`
- `architecture/state_machine.mmd`
- `architecture/knowledge_lifecycle.mmd`
