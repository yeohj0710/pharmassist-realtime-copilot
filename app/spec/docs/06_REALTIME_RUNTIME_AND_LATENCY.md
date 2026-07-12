# 06. Realtime Runtime and Latency Design

## 1. 성능 목표의 정확한 정의

`1초`는 환자가 말을 시작한 시점도, 모델의 완성 답변도 아니다. 다음 기준으로 측정한다.

### Typed t0

IME composition이 끝난 뒤 routable query가 생성된 시점.

### Voice t0

Realtime transcription에서 임상적으로 routable한 안정 prefix가 도착한 시점. 환자가 “저기요…”만 말한 때는 t0가 아니다.

### First useful card

약사가 즉시 말하거나 다음 질문을 결정할 수 있는 다음 중 하나:

- `say_now` 한 줄
- critical red-flag 행동
- blocking slot 질문 한 줄
- 상위 3개 intent 선택 UI

LLM 보정 완료는 first useful card 정의에 포함하지 않는다.

## 2. 지연시간 예산

| 구간 | Typed exact P95 | Voice stable-prefix P95 |
|---|---:|---:|
| event/IME 처리 | 10ms | 10ms |
| normalize/PII/slots | 20ms | 25ms |
| red-flag gate | 15ms | 15ms |
| exact/rule retrieval | 35ms | 40ms |
| BM25/fuzzy fallback | 80ms | 100ms |
| stability/controller | 20ms | 120ms 이내 |
| React render | 16ms | 16ms |
| 총 목표 | ≤250ms | ≤700ms |

음성의 OpenAI 전사 네트워크 구간은 안정 prefix가 도착하기 전이므로 별도로 측정한다. `speech-start → first transcript delta`, `speech-start → routable prefix`, `routable prefix → card`를 모두 기록하되 제품 SLA는 구분해서 표시한다.

## 3. 이벤트 파이프라인

```text
input event
  → sequence increment
  → normalize
  → PII redaction view
  → slot/negation extraction
  → immediate critical safety check
  → candidate retrieval
  → stability/hysteresis
  → instant card render
  → optional refinement request
```

각 단계는 `performance.now()`로 계측하며 production에서는 bucketed latency만 보낸다.

## 4. 타이핑 경로

### IME 안전

- `compositionstart`~`compositionend` 동안 서버/검색 요청을 만들지 않는다.
- composition 중에는 로컬 UI만 반영한다.
- composition 종료 후 microtask 또는 짧은 debounce로 검색한다.

### Query update

- 1~2글자 일반 입력은 빈/도움 UI를 유지할 수 있다.
- critical red-flag exact prefix는 길이 제한을 우회한다.
- backspace로 의미가 바뀌면 sequence를 증가시키고 이전 refinement를 abort한다.

### Cache

- normalized query → result의 bounded LRU
- alias prefix → candidate IDs cache
- card ID → rendered view model cache
- same query/slots/knowledge version이면 모델을 다시 호출하지 않음

## 5. 음성 경로

### Push-to-talk 기본

항상 켜진 주변 청취보다 다음 이유로 push-to-talk를 기본으로 한다.

- 환자·동행인·주변인의 건강·신원정보 수집 최소화
- 약국 소음과 다른 대화 혼입 감소
- 명확한 시작/종료로 ASR 정확도 개선
- 법적 고지와 사용자 통제가 쉬움

hands-free는 별도 법무/개인정보 검토와 현장 동의 UX 후에만 플래그로 연다.

### WebRTC

브라우저 오디오 캡처에는 WebRTC를 사용한다. 표준 OpenAI key는 서버에만 두고, 서버가 제한된 세션을 생성한다. 네트워크 단절을 감지하면 즉시 타이핑 경로로 전환한다.

### Transcript delta handling

- delta를 append-only로 가정하지 않고 event semantics에 맞춰 관리한다.
- stable prefix와 unstable suffix를 구분한다.
- 80~120ms 동안 바뀌지 않은 토큰 또는 높은 confidence exact alias를 안정으로 간주한다.
- critical pattern은 안정 대기를 줄인다.
- final transcript가 오면 마지막으로 재평가하되 약사가 freeze한 카드는 바꾸지 않는다.

### 약학 용어 사전

- 브랜드명, 일반명, 성분명, 제형, 단위, 흔한 약칭
- 한국어 음운 유사 alias
- 약국 지역/고객층 표현
- 틀린 교정을 강제로 확정하지 않고 후보로 유지

사전은 임상 claim과 별도이며, ASR 교정은 제품을 확정하는 근거가 아니다.

## 6. Normalization 상세

권장 순서:

1. Unicode NFKC
2. zero-width/control 제거
3. 공백/문장부호 정규화
4. 한글·영문·숫자 단위 표준화
5. PII 탐지/마스킹
6. known ASR confusion alternatives 생성
7. negation span 태깅
8. temporal/age/weight/dose unit parsing
9. product/ingredient alias lookup
10. normalized token stream과 원본 display stream 분리

예:

```text
"애기 네살 십육키로 부루펜 몇씨씨"
→ tokens: [child, age_years=4, weight_kg=16, product_alias=AMBIGUOUS, volume_question]
→ blocking: exact product + concentration
```

`부루펜` 같은 브랜드 유사 표현이 여러 제품/농도에 걸리면 product ID를 확정하지 않는다.

## 7. Negation

잘못된 응급 알림을 줄이기 위해 간단한 키워드 포함 검색으로 끝내지 않는다.

- `숨이 차요` → positive
- `숨은 안 차요` → negated
- `어제는 숨이 찼지만 지금은 괜찮아요` → historical positive + current negative; 여전히 임상 review rule에 따라 처리
- `숨 안 쉬어질 정도는 아니고` → weak/negated pattern; 문맥 테스트 필요

구현:

- negation cue lexicon
- cue에서 좌우 token window
- conjunction/문장 경계
- temporality tag
- exception phrase tests
- critical ambiguous case는 false reassurance보다 확인 질문으로 전환

LLM만으로 negation을 판단하지 않는다.

## 8. Candidate scoring과 안정성

### Candidate generation

- exact alias: strong candidate
- rule: strong candidate
- BM25: medium
- trigram: weak
- slot fit: boost
- blocking missing: action 제한, intent 자체는 유지 가능
- negative pattern: 제거 또는 강한 감점
- domain mismatch: 제거

### Hysteresis

- 기존 카드와 새 카드의 점수 차이가 `switchMargin` 미만이면 유지
- 같은 intent에 슬롯만 추가되면 같은 카드 내부 업데이트
- critical red flag는 항상 switch
- pharmacist manual selection은 freeze와 동등한 우선순위
- provisional badge는 final/stable까지 유지

### Top-3 UI

top1과 top2 차이가 threshold보다 작으면 모델이 임의 확정하지 않고 3개 선택 버튼을 보여준다. 버튼 텍스트는 짧고 구분 질문을 함께 제시한다.

## 9. LLM refinement 경로

### 호출 조건

- local confidence가 낮지만 안전 gate는 통과
- 문장 길이를 줄여야 함
- 여러 verified card 문구를 합쳐야 함
- 약사가 명시적으로 요청

### 요청 최소화

```json
{
  "normalized_query": "...redacted...",
  "slots": {...},
  "candidate_cards": [
    {"card_id":"...","approved_say_now":["..."],"allowed_claims":[...]}
  ],
  "hard_constraints": {...},
  "sequence": 14,
  "knowledge_version": "..."
}
```

원본 문서, 장문 환자 transcript, 불필요한 PII를 보내지 않는다.

### 모델 설정

- default `gpt-5.6-luna`, reasoning `none`
- 복합/애매 `gpt-5.6-terra`, reasoning `low`
- strict Structured Outputs
- max output 약 420 tokens 이하
- streaming
- `store:false`
- timeout 2.5초
- 재시도 0~1회, 다른 모델로 자동 의료 사실 확대 금지

### 검증

모델 결과는 다음을 통과해야 한다.

- schema
- sequence current
- claim ID allowlist
- 금지 표현
- 숫자/단위 provenance
- missing slot gate
- red-flag consistency
- maximum text length

실패하면 로컬 카드 유지.

## 10. 동시성·취소

- 매 입력에 증가하는 sequence
- active refinement는 `AbortController`
- 응답 수신 시 sequence/knowledge version/session 확인
- current와 다르면 render하지 않고 `stale_response_dropped=true` metric
- 네트워크 요청은 UI thread를 막지 않음
- Web Worker 메시지도 sequence-aware

## 11. 브라우저 성능

- pack은 gzip/brotli된 static asset
- 앱 시작 후 Web Worker에서 parse/index
- 가능한 경우 precompiled binary/SQLite WASM 검토
- 카드 본문과 index를 분리해 초기 로드 최소화
- 1차 intent index는 메모리, 상세 source는 lazy load
- React state는 전체 transcript마다 거대한 객체를 재렌더하지 않음
- card pane과 transcript pane 분리 memoization

## 12. 벤치마크

### Microbench

- normalize 10,000 queries
- red-flag/negation 10,000 cases
- alias/trie query
- BM25 top-k
- pack parse/cold load

### End-to-end

- typed exact/fuzzy
- IME composition
- 20Hz transcript delta simulation
- 30ms/100ms RTT
- packet loss/reconnect
- slow Responses stream
- stale response race
- offline mode

각 벤치마크는 p50/p95/p99와 최대 메모리를 출력한다. CI에는 완화된 regression threshold, release pipeline에는 reference hardware threshold를 둔다.

## 13. 제품 문구

허용:

> “입력형 상담카드는 검증 환경에서 대개 1초 이내 표시됩니다.”

피해야 함:

> “모든 환자 음성을 듣고 1초 안에 완벽한 의학 답변을 보장합니다.”

실제 보장 범위와 계측 정의를 사용자·사업 문서에 일치시킨다.
