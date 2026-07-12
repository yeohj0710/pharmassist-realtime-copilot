# 09. Evaluation and Golden Tests

## 1. 평가 원칙

“모델이 그럴듯하다”가 아니라 다음 층을 별도로 측정한다.

1. ASR
2. normalization/entity/negation
3. safety gate
4. intent/card retrieval
5. missing-slot behavior
6. factual/source compliance
7. LLM phrasing
8. latency/reliability
9. pharmacist usability
10. privacy/security

전체 점수 하나로 합치지 않는다. critical safety metric은 평균으로 상쇄할 수 없다.

## 2. 데이터셋

### Synthetic suite

`examples/golden_cases.sample.jsonl`에 동작 예시가 있다. 이는 치료 정답이 아니라 다음을 검증한다.

- 위험신호 우선
- 부정어
- 필수 슬롯
- 도메인 분리
- PII 마스킹
- sequence/stale response
- offline fallback

### Pharmacist-authored gold set

운영 전 약사들이 직접 작성한다.

- 흔한 짧은 키워드
- 불완전한 환자 발화
- 잘못된 제품명/약칭
- 소아/임부/고령자
- 복합제 중복
- red flags와 부정 표현
- 의뢰가 필요한 사례
- no-match/다른 도메인

각 case는 다음을 가진다.

- 최소 입력과 변형 utterance
- expected intent set
- required/missing slots
- mandatory/forbidden output claims
- red-flag action
- acceptable phrasing 범위
- reviewer와 근거

### Real audio set

명시적 동의와 적법한 절차로 수집하며 de-identification한다.

- 약국 소음
- 마스크 착용
- 노년층/소아 보호자/지역 억양
- 브랜드·성분·단위
- 말 겹침
- 낮은 음량

원본 보존 필요성이 없으면 특징/전사 평가 후 삭제하는 정책을 우선한다.

## 3. Metrics

### ASR

- Korean character error rate
- domain entity error rate
- product/ingredient top-k recall
- number/unit error rate
- time to first delta
- time to routable stable prefix

의료적으로 중요한 entity error를 일반 CER보다 별도 가중한다.

### Retrieval

- intent top-1 accuracy
- intent top-3 recall
- exact alias precision
- no-match precision
- domain leak rate
- card switch count per utterance

초기 목표:

- top-1 ≥ 94%
- top-3 ≥ 98%
- domain leak 0 in release suite

### Safety

- critical red-flag recall ≥ 99.5%
- critical red-flag precision은 alert fatigue를 함께 보고 조정
- high-risk missing-slot block ≥ 99.9%
- unsupported numeric output 0
- expired/unapproved claim output 0
- false reassurance critical cases 0

### Factual/source

- every claim ID resolves
- source tier/locator/date validity
- exact match between numeric output and deterministic calculator
- model added unsupported medical fact rate 0 in release suite
- product version mismatch 0

### LLM phrasing

약사 blind review:

- clinically faithful
- concise
- natural Korean
- immediately speakable
- not alarming/marketing
- no omitted safety qualifier

LLM 결과는 local card보다 나빠지면 사용하지 않는다. `refinement win rate`와 `harmful edit rate`를 함께 측정한다.

### Latency

- app cold/warm start
- typed exact/fuzzy p50/p95/p99
- voice speech→delta, delta→stable prefix, stable prefix→card
- Responses time to first structured update
- total request timeout rate
- stale response drop count

### Usability

- first-glance actionability
- time to next pharmacist utterance
- accept/edit/reject/escalate rate
- number of clicks/keystrokes
- freeze usage
- alert fatigue
- patient interaction disruption

## 4. Release suites

### Unit suite

- normalization variants
- Korean negation scopes
- number/unit parsers
- product alias ambiguity
- slot validators
- dose calculator boundaries
- source expiry/claim graph
- sequence reducer

### Integration suite

- Web Worker engine with pack
- API schema
- Responses mock streaming
- invalid/malicious model output
- Realtime event replay
- pack update/signature/rollback
- no raw log assertions

### E2E suite

- typed counseling flow
- push-to-talk mocked transcript
- critical escalation
- candidate selection
- freeze/unfreeze
- offline mode
- source detail
- feedback code
- keyboard/accessibility

### Adversarial suite

- prompt injection in patient input
- source injection in authoring docs
- irrelevant/profane input
- false product names
- extreme numbers/units
- malformed Unicode
- PII
- model schema refusal
- delayed/out-of-order events
- cross-domain contamination

## 5. Golden test format

권장:

```json
{
  "case_id": "...",
  "input_events": [...],
  "initial_state": {...},
  "expected": {
    "allowed_modes": ["clarify"],
    "required_rules": ["WEIGHT_REQUIRED"],
    "forbidden_claim_ids": [],
    "required_slots": ["weight_kg"],
    "max_first_card_ms": 250,
    "must_not_call_llm": true
  },
  "evidence": [...],
  "reviewers": [...]
}
```

문장 완전 일치 대신 semantic constraints와 claim IDs를 검사한다. 핵심 안전 문구는 approved variants allowlist를 사용할 수 있다.

## 6. LLM eval

### Deterministic grading

- schema valid
- all source refs allowed
- no new numbers
- no forbidden expressions
- word/character limits
- no diagnosis
- red-flag consistency

### Pharmacist grading

- pairwise local vs refined
- blinded model/version
- at least two independent reviewers for high-risk sets
- disagreement adjudication
- inter-rater agreement 추적

### Regression

prompt/model snapshot 변경은 전체 safety/phrasing suite를 다시 실행한다. alias model로 자동 업데이트하지 않고 staging에서 비교한다.

## 7. Shadow pilot

처음에는 시스템 출력을 환자 상담 결정에 사용하지 않고 약사가 사후 평가한다.

- live input/전사에 대한 카드 정확도
- first-card timing
- 필요한데 안 뜬 red flag
- 불필요 alert
- 표현 유용성
- 개인정보 흐름

shadow 결과가 release gate를 만족한 카드군만 제한적 활성화한다.

## 8. Monitoring thresholds

예시 kill/rollback 조건:

- critical miss 보고 1건
- unsupported dose/contraindication 출력 1건
- wrong-domain clinical output 1건
- source expired but served 1건
- raw PHI log 발견 1건
- stale model response overwrite 재현
- 특정 카드 reject/override 급증

critical incident는 통계적 유의성을 기다리지 않는다.

## 9. 최소 데이터 규모

- 개발: 합성 50+ 및 카드별 unit cases
- 내부 검수: 승인된 gold 100+ 핵심 intent
- 현장 pilot 전: 500+ 변형 utterance와 critical oversampling
- 다기관 확대 전: 약국 환경/연령/억양/입력 방식 다양화

숫자 자체보다 coverage matrix와 고위험 oversampling이 중요하다.
