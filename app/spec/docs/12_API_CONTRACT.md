# 12. API Contract

## 1. 원칙

- JSON Schema가 단일 계약
- versioned `/v1`
- client request ID와 monotonic sequence
- idempotent/session-safe where applicable
- no raw patient text in logs
- typed local path는 API 없이도 작동
- external model errors never erase instant result

## 2. Endpoints

### `POST /v1/consult/instant`

서버 재검증/비브라우저 클라이언트용. 웹 PWA는 같은 engine을 Web Worker에서 직접 실행하는 것이 기본이다.

Request: `runtime_input.schema.json`  
Response: `runtime_output.schema.json`

Rules:

- 외부 LLM 호출 금지
- deterministic only
- timeout 500ms
- `Cache-Control: no-store`

### `POST /v1/consult/refine`

SSE stream. 현재 instant result와 승인 카드만 보낸다.

Request 예:

```json
{
  "runtime_input": {"...": "RuntimeInput"},
  "instant_output": {"...": "RuntimeOutput"},
  "candidate_card_ids": ["CARD-..."],
  "knowledge_version": "2026.07.10+001"
}
```

SSE events:

```text
event: refinement.started
data: {"request_id":"...","sequence":7}

event: refinement.delta
data: {"request_id":"...","sequence":7,"patch":{...}}

event: refinement.completed
data: {"runtime_output":{...}}

event: refinement.rejected
data: {"code":"UNSUPPORTED_CLAIM","fallback":"instant"}
```

보안:

- server builds the actual OpenAI payload
- `store:false`
- strict schema
- response claim IDs must be a subset of request allowlist
- stale sequence는 client와 server 모두 거부

### `POST /v1/realtime/session`

브라우저 WebRTC session 생성/unified SDP 교환용. 정확한 body는 선택한 OpenAI 연결 방식에 따라 adapter 내부에서 관리한다.

요구사항:

- authenticated pharmacist/tenant
- rate limit
- privacy-preserving `OpenAI-Safety-Identifier`
- allowed model fixed by server config
- short-lived session
- standard API key never returned
- no patient text in request log

Response는 SDP 또는 ephemeral session metadata를 사용 중인 공식 Realtime flow에 맞춰 반환한다. OpenAI API shape 변경을 격리하기 위해 `OpenAIRealtimeBroker` interface 뒤에 둔다.

### `GET /v1/knowledge/manifest`

현재 domain pack manifest와 revocation 정보를 반환한다.

```json
{
  "domain": "human_otc",
  "active_version": "2026.07.10+001",
  "sha256": "...",
  "signature": "...",
  "expires_at": "...",
  "min_app_version": "...",
  "revoked_card_ids": []
}
```

### `GET /v1/knowledge/packs/:version`

서명된 pack. ETag/immutable caching. 인증/테넌트 정책을 적용한다.

### `POST /v1/feedback`

자유 텍스트 기본 금지.

```json
{
  "session_id": "uuid",
  "sequence": 7,
  "card_id": "CARD-...",
  "outcome": "accepted|edited|rejected|escalated",
  "reason_codes": ["WRONG_INTENT"],
  "knowledge_version": "...",
  "latency_bucket": "100-250"
}
```

환자 식별자, raw query, transcript를 포함하면 400.

### `GET /v1/health/live`

프로세스 생존 여부. 외부 서비스 상태를 요구하지 않는다.

### `GET /v1/health/ready`

schema/config/active pack 검증. OpenAI failure는 typed core readiness를 실패시키지 않고 degraded component로 표시한다.

```json
{
  "status": "ready|degraded|not_ready",
  "components": {
    "knowledge": "ready",
    "openai_responses": "degraded",
    "openai_realtime": "ready"
  }
}
```

## 3. Admin/reviewer API

별도 audience/auth scope.

- `POST /v1/admin/sources`
- `POST /v1/admin/claims/import`
- `PATCH /v1/admin/claims/:id`
- `POST /v1/admin/cards`
- `POST /v1/admin/reviews`
- `POST /v1/admin/packs/build`
- `POST /v1/admin/packs/:version/publish`
- `POST /v1/admin/packs/:version/rollback`
- `POST /v1/admin/revocations`

publish/rollback은 audit reason과 승인자를 필수로 한다.

## 4. Error format

```json
{
  "error": {
    "code": "KNOWLEDGE_STALE",
    "message": "안전한 범위에서 표시할 수 없습니다.",
    "request_id": "...",
    "retryable": false,
    "safe_fallback": "clarify_or_refer"
  }
}
```

내부 stack, OpenAI payload, patient input을 반환하지 않는다.

주요 code:

- `INVALID_INPUT`
- `DOMAIN_DISABLED`
- `KNOWLEDGE_STALE`
- `CARD_REVOKED`
- `MISSING_BLOCKING_SLOT`
- `PRODUCT_AMBIGUOUS`
- `UNSUPPORTED_CLAIM`
- `MODEL_SCHEMA_INVALID`
- `MODEL_TIMEOUT`
- `REALTIME_UNAVAILABLE`
- `STALE_SEQUENCE`
- `RATE_LIMITED`
- `PRIVACY_REDACTION_FAILED`

## 5. OpenAPI

Codex는 JSON Schemas를 참조하는 OpenAPI 3.1 문서를 생성하고, integration tests에서 server response를 검증해야 한다. API docs의 예시는 합성 데이터만 사용한다.

## 6. Headers

- `X-Request-Id`
- `X-Session-Sequence`
- `X-Knowledge-Version`
- standard auth/CSRF as deployment profile requires
- `Cache-Control: no-store` for consultation/refinement
- CSP and security headers for web

환자/약물 내용은 header에 넣지 않는다.

## 7. Rate limiting

- Realtime session creation: pharmacist/session constrained
- refinement: debounce/dedup plus tenant quotas
- feedback: modest burst
- pack download: CDN/ETag
- admin publish: strict auth, no generic retry

rate limit 시 instant local card는 계속 동작한다.
