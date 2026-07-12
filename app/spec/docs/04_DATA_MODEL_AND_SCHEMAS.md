# 04. Data Model and Schemas

## 1. 설계 목표

의학 지식, 상담 표현, 제품 정보, 환자 세션을 분리한다. 한 문서 조각을 곧바로 답변으로 생성하는 대신 다음 계층을 둔다.

```text
SourceRecord → Claim → ConsultationCard → RuntimeOutput
                         ↑
                    DrugProduct / DUR
```

각 계층은 독립 버전·검수·만료를 가진다.

## 2. SourceRecord

원본 자료의 provenance와 사용 정책을 담는다.

필수 필드:

- `source_id`, title, domain
- trust tier A/B/C/D/X
- runtime policy
- jurisdiction/date/hash/locator
- copyright/redistribution policy
- review status, reviewers, claim-level verification requirement

원본 파일 해시는 변경 감지에 사용한다. 파일 수정 시 새 SourceRecord 버전을 만든다.

## 3. Claim

의학적/운영적 단위 사실이다. `subject-predicate-object`와 qualifier로 분리한다.

예:

```json
{
  "claim_type": "contraindication",
  "subject": "PRODUCT_OR_INGREDIENT_ID",
  "predicate": "is_contraindicated_when",
  "object": "STRUCTURED_CONDITION",
  "qualifiers": {"jurisdiction": "KR", "population": "..."}
}
```

중요 원칙:

- dose 문자열을 하나의 자유 텍스트로만 두지 않는다.
- 단위, 제형, 농도, 연령, 체중, 기간, 최대치, 제품을 구조화한다.
- 원문 locator를 유지한다.
- 고위험 claim은 official verification이 없으면 publish 불가.
- 충돌 claim을 명시적으로 연결한다.

## 4. DrugProduct

대한민국 제품별 공식 정보를 담는다.

- 제품 ID/코드/표시명/제조사
- 주성분과 함량
- 제형/투여경로
- 라벨 출처·수집시각·해시
- 판매/취하 상태
- DUR flag

`display_name`만으로 제품을 동일시하지 않는다. 제품 코드와 공식 source hash를 사용한다. 액상 제품은 농도·단위가 필수다.

## 5. ConsultationCard

카운터에서 즉시 표시할 승인 단위다.

### Trigger

- exact aliases
- synonyms
- phonetic/ASR aliases
- negative patterns
- domain

### Required slots

각 슬롯은 `when`, `blocking`, `question`, `validation`을 가진다. blocking slot이 비어 있으면 해당 action을 출력하지 않는다.

### Red flags

- pattern
- negation awareness
- emergency/same-day/doctor/stop-and-verify action
- 즉시 말할 문구

### Say/Ask/Actions/Avoid

- `say_now`: 환자에게 말할 짧은 문장
- `ask_next`: 정보이득 기준으로 정렬된 질문
- `actions`: self-care, ingredient category, administration, monitor, refer, verify product
- `avoid`: 금지된 단정/행동

### Source refs

운영 카드의 source ref는 A/B claim만 허용한다. C 자료에서 얻은 표현 아이디어는 출처 감사에 남기되 임상 claim ref로 쓰지 않는다.

### Review

약사 승인, 안전 승인, 검수자, 승인일, 만료일. 만료된 카드가 pack에 들어가면 빌드 실패.

## 6. RuntimeInput

환자 식별정보를 최소화한 일시적 세션 이벤트다.

- request/session/sequence
- typed/voice partial/final
- normalized 대상 text
- locale/domain
- 최소 patient context slots
- ASR confidence/alternatives
- client timestamp

환자 이름/전화번호/주민번호 필드를 스키마에 만들지 않는다. 자유 텍스트는 최대 길이를 제한한다.

## 7. RuntimeOutput

UI가 임의 자연어를 파싱하지 않도록 strict schema로 고정한다.

- `mode`: instant/refined/escalate/clarify/no_match
- `status`: provisional/stable/blocked/final
- say/ask/red flags/actions/avoid/missing slots
- confidence/candidates/source refs
- latency breakdown
- knowledge/model version
- stale response indicator

`runtime_output.schema.json`이 API·Web·LLM Structured Outputs의 단일 기준이다.

## 8. 세션 상태

세션 상태는 최소한으로 유지한다.

```ts
interface SessionState {
  sessionId: string;
  sequence: number;
  domain: Domain;
  normalizedText: string;
  slots: SlotState;
  currentCardId?: string;
  frozen: boolean;
  provisional: boolean;
  activeAbortController?: AbortController;
}
```

환자 고유 프로필을 만들지 않는다. 상담 종료 시 메모리 상태를 지우고 coded metrics만 남긴다.

## 9. Knowledge pack manifest

권장 필드:

```json
{
  "packVersion": "2026.07.10+001",
  "schemaVersion": "1.0.0",
  "minAppVersion": "0.1.0",
  "domain": "human_otc",
  "createdAt": "...",
  "approvedAt": "...",
  "expiresAt": "...",
  "cardCount": 0,
  "claimCount": 0,
  "sourceCount": 0,
  "sha256": "...",
  "signature": "...",
  "reviewerIds": ["..."],
  "goldenSuiteVersion": "..."
}
```

pack은 수정하지 않고 새 버전을 만든다.

## 10. 데이터 불변조건

1. published card의 모든 claim은 published/verified여야 한다.
2. published card source tier는 A/B만 허용한다.
3. blocking slot이 비어 있으면 연결 action이 차단된다.
4. 제품별 수치 claim은 정확한 product/version과 연결된다.
5. `expires_at <= now`이면 runtime unavailable.
6. animal/supplement card는 human index에 들어갈 수 없다.
7. synthetic/placeholder 데이터는 production pack에 들어갈 수 없다.
8. model output은 DB에 새로운 claim을 생성하거나 publish하지 못한다.
9. 모든 output은 knowledge version으로 재현 가능해야 한다.
10. UI에 표시한 임상 문구는 source ref로 역추적 가능해야 한다.

## 11. 스키마 파일

- `schemas/source_record.schema.json`
- `schemas/claim.schema.json`
- `schemas/drug_product.schema.json`
- `schemas/consultation_card.schema.json`
- `schemas/runtime_input.schema.json`
- `schemas/runtime_output.schema.json`

Codex는 이 JSON Schema에서 TypeScript 타입과 런타임 validator를 생성하거나 동일 스키마를 직접 import하여 중복 정의를 막아야 한다.
