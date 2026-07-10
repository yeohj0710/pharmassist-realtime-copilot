# 07. Clinical Safety Guardrails

## 1. 역할 경계

이 시스템은 약사의 임상 판단을 돕는 정보 표시 도구다.

- 환자에게 직접 진단하지 않는다.
- 처방을 시작·중단·변경하지 않는다.
- 약사의 확인 없이 고위험 수치나 행동을 확정하지 않는다.
- 약사가 현재 환자 상황과 제품 라벨을 확인할 책임을 대체하지 않는다.
- 오류 가능성을 숨기지 않고 source/version/confidence를 보여준다.

UI와 이용약관의 “참고용” 문구만으로 안전이 확보되는 것은 아니다. 기술적 차단과 검수 체계가 필수다.

## 2. 안전 우선순위

```text
응급/중증 신호
  > 알레르기·금기·상호작용·중복
  > 임부/수유/소아/고령 등 특수군
  > 필수 슬롯
  > 제품/농도 식별
  > 일반 상담/자가관리
  > 표현 보정/편의
  > 제품/재고/판매 정보
```

낮은 우선순위가 높은 우선순위를 덮어쓸 수 없다.

## 3. Red-flag engine

### 원칙

- 추천과 독립된 deterministic layer
- critical/same-day/doctor/stop-and-verify 등 행동 수준
- positive/negative/uncertain/temporal 상태
- partial transcript에서도 critical exact pattern 즉시 반응
- false negative를 최우선으로 줄이되 negation-aware로 불필요 경보도 관리

### 범주 예시

실제 문구와 기준은 약사·공식 지침 검수 후 채운다.

- 심한 호흡곤란, 청색증, 의식 변화
- 흉통·식은땀·실신
- 급성 신경학적 이상
- 중증 알레르기 가능 신호
- 출혈/흑변/혈변
- 심한 탈수 또는 지속 구토
- 시력 변화·심한 안통
- 점막 침범 피부반응
- 임신/산후의 특정 경고 신호
- 소아의 위험 상태
- 약물 과량·오복용·자해 가능성

red flag card는 일반 제품 추천을 숨기고, 응급/의뢰 문구와 행동만 표시한다.

## 4. Mandatory slots

### 공통

- 나이 또는 연령군
- 증상 부위/종류
- 기간/발병 양상
- 중증도와 red flags
- 알레르기
- 현재 복용약/중요 질환

### 조건부

- 소아: 체중, 제품, 농도, 최근 투여량/시각
- 임신: 임신 가능성/주수, 정확한 제품/성분
- 수유: 수유 여부, 영아 연령/상태, 정확한 제품
- 피임약 누락: 정확한 제품, 놓친 정수, 시점, 포장 위치
- 액상 용량: 농도/단위/계량도구
- 상호작용: 전체 제품/성분, 처방·OTC·건기식 포함
- 피부: 부위, 범위, 점막, 통증/열, 기간
- 안과/귀: 통증, 시력/청력 변화, 외상/이물

blocking slot이 없으면 숫자·제품별 행동을 출력하지 않는다.

## 5. Numeric safety

### 숫자 출력 허용 조건

모두 충족해야 한다.

1. product ID가 공식 레코드로 확정
2. 제형/농도/단위가 일치
3. 필요한 나이/체중/임신 등 슬롯 유효
4. 공식 A claim이 published이며 만료 전
5. 계산식이 deterministic code로 구현
6. 단위 테스트와 boundary test 통과
7. 약사 확인 UI

LLM이 산술 계산 또는 라벨 해석을 담당하지 않는다. 모델이 숫자를 생성해도 allowlist claim과 calculator result에 정확히 일치하지 않으면 폐기한다.

### 계산기

- decimal library 사용
- floating-point 표시 오차 방지
- 단위 변환 명시
- 최소/최대/빈도/일일 총량을 각각 검증
- rounding policy를 제품별 claim에 저장
- 계산 trace를 약사에게 펼쳐볼 수 있음

## 6. 제품·성분 중복

- 제품명 → 공식 product → active ingredients로 해석
- 동일/중복 therapeutic ingredient 체크
- 복합제의 숨은 중복을 강조
- 현재 약 목록이 불완전하면 “전체 제품 확인” 질문
- DUR/공식 데이터가 연결되지 않았으면 완전한 안전 확인이라고 표현하지 않음

## 7. Allergy/contraindication/interactions

- 환자 알레르기 문자열과 ingredient/class alias를 deterministic match
- class-level cross-reactivity는 별도 검증 claim
- contraindication과 precaution을 UI에서 구분
- interaction severity와 action을 구조화
- 약사가 확인하지 않은 불명확 제품은 safe match로 간주하지 않음
- 건기식도 current medication 목록에 포함 가능하도록 설계

## 8. 특수군

### 소아

- “어린이”만으로 연령·체중 추정 금지
- 보호자가 말한 체중/제품 라벨을 확인
- 성인 제품 분할/대체를 임의 제안하지 않음
- 증상보다 상태·수분섭취·의식·호흡 등 위험평가 우선

### 임부/임신 가능성

- 임신 가능성이 불명확하면 `unknown/possible`
- 일반적인 안전 표현도 제품·시기 차이를 무시하지 않음
- 공식 제품 라벨과 승인된 임상 기준 연결
- 위험/이득 판단이 필요한 경우 처방기관/의료진 확인으로 전환

### 수유

- 성분, 용량, 투여시각, 영아 연령/상태 차이를 고려하는 별도 카드
- 단순 “수유 중 가능/불가” 이진표로 축약하지 않음

### 고령자/다약제

- 의약품 목록과 낙상·진정·항콜린·신장/간 기능 관련 검토
- 약 이름이 불확실하면 제품 확인 전 추천 축소

## 9. 진단 방지

금지 표현 예:

- “분명히 ○○병입니다”
- 외형·얼굴색·체질만으로 결핍/장기 상태 확정
- 영상/사진 없이 피부질환 확정
- 흰 알약 외형만으로 약 확정

허용 방향:

- “이 증상만으로 확정할 수는 없습니다.”
- “먼저 위험 신호와 기간을 확인하겠습니다.”
- “정확한 제품/포장/처방전을 확인해야 합니다.”
- “이 경우 일반약 선택보다 의료기관 평가가 우선입니다.”

## 10. 상담 문구 안전

- 환자를 겁주거나 과장하지 않음
- “세게”, “때려잡다”, “무조건 여러 개” 같은 판매 표현 금지
- 치료 보장 금지
- 제품이 아니라 환자의 목표와 위험을 먼저 말함
- 한 번에 최대 한 질문을 기본으로 제시
- 이해 확인용 teach-back 문구를 선택적으로 제공

## 11. LLM guardrail

System prompt는 다음을 강제한다.

- provided verified claims only
- no new medical facts
- no diagnosis
- no numeric rule unless supplied as validated structured value
- missing slot → ask
- red flag → escalate
- output strict schema
- source IDs preserved
- brief Korean

출력 후 deterministic validator가 다시 검사한다. 프롬프트는 안전장치 중 하나일 뿐 최종 방어선이 아니다.

## 12. Source guardrail

- source tier C/D/X의 text를 runtime model에 직접 넣지 않음
- published card는 A/B claim만
- 만료·충돌·withdrawn product 자동 차단
- label change diff가 감지되면 영향 카드 stale
- source unavailable이면 이전 snapshot의 유효성과 만료를 확인하고 필요 시 차단

## 13. Human confirmation

다음은 confirmation modal 또는 hold-to-confirm이 필요하다.

- 숫자 용량/빈도/기간
- 임부·수유 제품별 안내
- 중대한 상호작용/금기
- 처방약 복용 변경으로 오해될 수 있는 문구
- 응급/당일 의뢰
- 제품 식별이 필요한 결과

확인은 “AI가 맞다” 승인 버튼이 아니라, 약사가 환자·제품·출처를 확인했다는 의미다.

## 14. 안전 incident

incident 유형:

- wrong escalation / missed escalation
- wrong dose/product/ingredient
- contraindication/interaction miss
- stale label
- source policy violation
- privacy exposure
- audio capture without expected control
- hallucinated unsupported claim

대응:

1. affected card/pack kill switch
2. previous pack rollback
3. evidence/log preservation without patient raw data
4. pharmacist safety review
5. root cause and regression test
6. controlled republish

## 15. Release hard gates

- critical red-flag recall ≥ 99.5% on approved suite
- high-risk missing-slot block ≥ 99.9%
- unsupported numeric outputs 0
- expired/unapproved source references 0
- human/animal domain leaks 0
- schema invalid outputs 0 after validator
- stale response overwrite 0
- raw patient audio/transcript persisted 0 under defaults

수치 목표는 최소 release gate이며 실제 환자 안전 검증을 대신하지 않는다.
