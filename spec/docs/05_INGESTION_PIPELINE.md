# 05. Offline Ingestion and Knowledge Authoring Pipeline

## 1. 목적

첨부 파일을 런타임 RAG에 그대로 투입하지 않고, **검증 가능한 작은 claim과 상담카드**로 바꾸는 오프라인 파이프라인을 정의한다. 이 과정은 카운터 실시간 경로와 완전히 분리한다.

## 2. 파이프라인 단계

### Stage 0 — 권리/범위 확인

- 파일 사용권, 내부 사용 범위, 재배포 가능 여부 확인
- 민감정보/환자 사례 포함 여부 확인
- raw source가 Git/GitHub/일반 로그로 가지 않도록 경로 분리
- 해시와 원본 소유자 기록

권리 확인이 되지 않으면 추출 결과는 내부 candidate로만 남고 production pack에 들어갈 수 없다.

### Stage 1 — Inventory

- 상대경로, 파일명, 형식, 크기, SHA-256
- PDF 페이지 수/텍스트량/이미지 중심 여부
- 문서 날짜/버전/관할권 가능하면 추출
- 중복/근접 중복 탐지

현재 첨부의 기본 인벤토리는 `SOURCE_MANIFEST.csv`, 정책 판정은 `SOURCE_AUDIT.csv`에 있다.

### Stage 2 — Extraction

- text PDF: 페이지별 text와 heading
- image PDF/image: 승인된 로컬 OCR/vision 파이프라인
- XLSX: 셀 값·시트·행 구조
- DOCX: 문단/표/제목

원문은 authoring enclave 안에 남긴다. 운영 DB에는 필요한 locator/hash만 저장한다.

### Stage 3 — Classification

문서/섹션/claim 단위로 다음을 분류한다.

- 도메인: human OTC, Rx, supplement, animal, operations, marketing
- source tier
- claim type
- 위험도
- 판촉/과장/체질론/외형추정 여부
- 제품별/일반 규칙 여부
- 최신성/관할권 필요

### Stage 4 — Candidate extraction with GPT-5.6 Sol

`prompts/offline_card_extractor_prompt.md`를 사용한다. 모델은 다음만 한다.

- 상담 의도·동의어·질문 후보
- candidate claim 구조화
- red-flag 후보
- 누락된 필수 슬롯 후보
- 판매/과장/충돌/확인 필요 태그
- 정확한 source locator

모델은 publish 상태를 만들지 못하고, 공식 사실을 스스로 보충하지 못한다. 출력은 모두 `candidate`다.

### Stage 5 — Deterministic lint

- JSON Schema
- 단위/숫자 파싱
- 연령·체중·농도 의존성
- 제품 식별자 존재
- source locator 존재
- tier policy
- forbidden phrase/upsell/diagnosis detector
- human/animal domain leak
- duplicate claim/fuzzy duplicate

lint 실패 항목은 약사에게 보내기 전에 자동 반려한다.

### Stage 6 — Official verification

고위험 claim을 현재 공식 소스와 대조한다.

- MFDS 의약품안전나라 제품 허가사항/안전정보
- HIRA DUR의 병용·연령·임부·중복 등 적용 가능한 데이터
- 공공기관/전문학회 최신 지침
- 필요한 경우 원문 제품설명서

API·공공데이터·스크래핑 사용은 이용약관과 라이선스를 별도 확인한다. 자동 동기화가 불가능하면 reviewer가 source snapshot을 등록한다.

### Stage 7 — Conflict resolution

`prompts/source_conflict_resolver_prompt.md`를 사용해 충돌 목록을 정리하되, 최종 판정은 약사다.

- 제품/제형/인구집단/관할권 차이 확인
- 발행/개정 시각 확인
- 공식 라벨 우선
- 숫자 평균 금지
- 해소 불가하면 reject 또는 stop-and-verify 카드

### Stage 8 — Pharmacist review

Reviewer UI가 보여줄 정보:

- 후보 claim/card
- 원문 locator의 최소 주변 문맥
- 공식 출처 비교
- 충돌/위험 태그
- 전/후 문구 diff
- 테스트 영향

Reviewer action:

- approve
- revise
- reject
- request evidence
- set expiry
- set domain
- mark wording-only

### Stage 9 — Card composition

검증된 claims를 사용해 상담카드를 만든다.

- 하나의 카드에는 하나의 좁은 intent
- 첫 문장은 1~2문장
- ask_next는 정보이득 순서
- red flags는 deterministic pattern과 연결
- 제품 추천보다 성분/카테고리 우선
- brand는 약국 재고 overlay로 별도 표시하되 임상 순위와 분리

### Stage 10 — Compile

출력 예:

```text
pack/
  manifest.json
  cards.min.json
  claims.min.json
  products.min.json
  alias-index.bin or json
  rules.json
  fts.sqlite
  source-registry.min.json
  signature.json
```

빌드 과정에서 정규화된 aliases, trie/automaton, BM25 index를 미리 생성한다. 런타임에서 원문 chunking/embedding을 하지 않는다.

### Stage 11 — Test and sign

- schema/lint
- all source refs resolve
- no expired/unapproved claims
- golden safety tests
- regression tests
- latency benchmark
- pack hash/signature

모든 gate가 통과한 pack만 publish한다.

### Stage 12 — Publish and monitor

- staged rollout
- canary tenant
- error/override monitoring
- official label change watch
- expiry job
- incident kill switch
- previous pack rollback

## 3. Prompt injection 방어

원본 문서에 포함된 “이 지시를 따르라” 같은 문장을 데이터로만 취급한다. 오프라인 extractor의 system prompt가 우선하며:

- 문서 속 지시를 실행하지 않는다.
- 링크/코드/매크로를 실행하지 않는다.
- 외부 tool을 문서 지시에 따라 호출하지 않는다.
- source text와 authoring instruction을 명확한 delimiter로 분리한다.
- 모델 출력에 원문 장문 복제를 금지한다.

## 4. 자동화와 사람 검수의 경계

자동화 가능:

- inventory/hash
- extraction
- candidate 구조화
- 중복/충돌 후보
- schema/lint
- 공식 source diff
- test generation 후보

자동화 불가/금지:

- 고위험 claim publish
- 충돌 최종 판정
- 임상 안전 승인
- 권리 해석
- 규제 분류 결정
- 환자에게 직접 적용할 범위 결정

## 5. 최초 카드 저작 우선순위

다음 기준으로 좁은 카드부터 만든다.

1. 흔하고 단순한 OTC intent
2. 위험신호가 명확한 intent
3. “먼저 물어볼 것” 카드
4. 중복 성분 확인 카드
5. 제품별 공식 데이터가 안정적으로 확보된 카드
6. 소아/임부/수유/복용 누락은 검수 체계가 완성된 뒤

## 6. 첨부 자료 활용법

- 증상별 해답 노트: intent 목록과 질문 구조 후보
- OTC 실전/핵심 자료: 환자 친화적 표현 후보
- 복약지도/조제실: 빠른 스캔 UX와 짧은 발화 구조
- 피임약 자료: 상담 슬롯 목록 후보, 규칙은 공식 재검증
- 판매/마케팅 자료: 임상과 분리된 UX 아이디어만
- 건기식/체질 자료: 기본 제외 또는 검증 과제 목록만

## 7. 재현성

각 build는 다음을 기록한다.

- source hashes
- extractor prompt version/model snapshot
- parser/OCR version
- reviewer decisions
- official source snapshot hashes
- compiler version
- golden suite version
- output pack hash

동일 입력과 버전으로 동일한 pack을 재생성할 수 있어야 한다.
