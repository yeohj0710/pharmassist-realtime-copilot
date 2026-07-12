# 10. Deployment, Security, and Observability

## 1. 배포 프로필

### Profile A — Single-pharmacy local-first

- 약국 PC의 Docker Compose 또는 로컬 서비스
- PWA/웹 앱은 localhost 또는 사내 LAN
- SQLite/immutable pack
- OpenAI 호출만 외부
- typed core는 인터넷 없이 작동

장점: 지연·프라이버시·운영 단순성. 초기 pilot에 권장.

### Profile B — Managed multi-tenant cloud

- stateless web/API containers
- PostgreSQL tenant isolation
- object storage for signed packs
- KMS/secret manager
- WAF/rate limit/central observability
- regional/data residency 요구 검토

장점: 다기관 업데이트와 중앙 검수. 개인정보·규제 부담이 커진다.

### Profile C — Desktop wrapper

PWA를 Tauri로 감싸 로컬 배포/자동 업데이트/키보드 제어를 강화할 수 있다. v1 필수는 아니며 web core와 지식 엔진을 그대로 공유한다.

## 2. 네트워크 경계

- Browser → app API: TLS, same-site origin 우선
- Browser → OpenAI Realtime: server-created session/unified WebRTC
- API → OpenAI Responses: server only
- authoring environment → official sources: 별도 네트워크/자격증명
- raw source와 patient runtime을 같은 저장소/권한에 두지 않음

## 3. Secrets

- `OPENAI_API_KEY`는 secret manager 또는 local protected env
- browser bundle에 API key, database credential, signing private key 금지
- Realtime 세션은 짧고 제한된 credential/connection
- knowledge pack signing private key는 authoring/release pipeline에만
- production과 staging 프로젝트/키 분리
- key rotation runbook

## 4. OpenAI 데이터 설정

- Responses: `store:false`
- background mode: off
- persistent Conversations: off
- hosted vector stores/files: patient runtime에서 off
- prompt에는 raw audio/transcript 대신 redacted structured state
- Realtime endpoint의 abuse monitoring/retention과 조직의 ZDR/MAM eligibility 확인
- data sharing opt-in 상태 확인
- DPA, subprocessors, data location/cross-border transfer 검토

`store:false`만으로 모든 처리·보존 이슈가 끝나는 것으로 표현하지 않는다.

## 5. 개인정보 최소화

### 수집하지 않는 값

- 환자 이름
- 전화/주소/주민번호
- 계정형 환자 profile
- raw audio
- raw transcript
- 자유 텍스트 상담 로그

### 일시적으로 처리 가능한 값

- 나이/체중/임신/수유/증상/복용약 등 상담에 필요한 최소 건강정보
- 브라우저 메모리 내 session state
- external API 전 redacted/structured subset

### 저장 가능한 coded event

```json
{
  "tenant": "pseudonym",
  "pharmacist": "pseudonym",
  "card_id": "CARD-...",
  "result": "accepted|edited|rejected|escalated",
  "reason_code": "...",
  "latency_bucket": "100-250",
  "knowledge_version": "...",
  "model_snapshot": "..."
}
```

## 6. Threat model

### 위협

- API key 노출
- patient input prompt injection
- malicious source document injection
- cross-tenant data leak
- stale/forged knowledge pack
- model hallucination
- log/trace PHI exposure
- browser extension/screen shoulder-surfing
- microphone unintended capture
- dependency/supply-chain compromise
- official data sync poisoning/error

### 통제

- server-only keys
- strict schema/allowlist
- source prompt isolation
- tenant-scoped authorization and row-level security
- signed pack/hash/version
- post-generation validators
- no free-text logs
- automatic screen timeout/privacy mode 옵션
- push-to-talk and visible indicator
- lockfile/SBOM/dependency scanning
- official source hashes and reviewer diff

## 7. Authentication/authorization

초기 로컬 pilot이라도 관리자/저작 기능은 카운터 기능과 분리한다.

역할:

- pharmacist: runtime, coded feedback
- reviewer: claim/card review
- publisher: pack release/rollback
- admin: tenant/config, no arbitrary clinical approval unless also reviewer
- auditor: read-only provenance/events

고위험 publish는 2인 승인 옵션을 지원한다.

## 8. Logging

### 허용

- request ID, sequence, endpoint
- status/error code
- timing
- card/rule/claim IDs
- model/pack version
- token/cost bucket
- redaction count

### 금지

- request body raw text
- transcript
- audio
- patient slots가 그대로 드러나는 로그
- model full prompt/output
- source copyrighted passages

개발 모드의 debug log도 합성 데이터에서만 활성화한다.

## 9. Observability

대시보드:

- first-card latency p50/p95/p99
- transcription connect/delta latency
- refinement timeout/error/schema reject
- no-match/top3/select rates
- card accept/edit/reject/escalate
- critical rule counts
- stale response drops
- pack version adoption/rollback
- source expiry queue
- privacy redaction and forbidden-log tests

alert:

- critical safety incident
- pack signature failure
- expired pack served
- schema rejection spike
- Realtime failure spike
- raw content detector hit
- cross-tenant authorization failure

## 10. Deployment pipeline

```text
lint → typecheck → unit → schema → source-policy lint
→ integration → e2e → safety golden → benchmark regression
→ SBOM/security scan → build images/PWA → sign artifacts
→ staging → pharmacist smoke review → canary → production
```

production promotion은 knowledge pack과 app release를 독립적으로 롤백 가능하게 한다.

## 11. Containers

권장 services:

- `web`
- `api`
- `postgres` (cloud profile; local can use sqlite)
- optional `otel-collector`
- optional reverse proxy

원본 자료/OCR/authoring은 runtime Compose에 포함하지 않는다.

## 12. Backups

백업 대상:

- source registry metadata
- verified claims/cards
- reviewer decisions
- pack artifacts/signatures
- configuration/audit events

백업 제외 기본:

- raw audio/transcripts
- ephemeral session state
- temporary model payloads

복구 테스트와 key/signature recovery runbook을 둔다.

## 13. Rollback/Kill switch

- card-level disable list
- claim-level revoke
- pack-level rollback
- model-refinement global off
- Realtime global off
- domain-level off

클라이언트는 짧은 주기로 signed revocation manifest를 확인하고, critical revoke는 즉시 적용한다. 네트워크가 끊기면 만료와 local denylist를 따른다.

## 14. 비용 통제

- exact/high-confidence는 LLM 호출하지 않음
- Luna를 기본, Terra는 ambiguity only
- output token 짧게
- prompt compact/structured
- model call dedup/cache는 환자 content 저장 없이 session memory에서만
- usage telemetry는 tenant 단위 aggregate
- Realtime은 push-to-talk로 불필요 audio 분을 줄임

비용 절감이 안전 gate나 공식 source 검증을 우회하지 않는다.
