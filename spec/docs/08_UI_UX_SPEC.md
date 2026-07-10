# 08. UI/UX Specification

## 1. 디자인 목표

약사는 환자를 보면서 1~3초 안에 화면을 훑는다. 따라서 UI는 챗봇 대화창이 아니라 **상담 계기판**이어야 한다.

- 가장 중요한 한 문장이 항상 같은 위치
- 다음 질문 하나가 명확
- 위험은 색상+텍스트+아이콘으로 중복 표현
- 긴 근거와 원문은 접힌 상세 패널
- 부분 전사 때문에 화면이 계속 흔들리지 않음
- 키보드 중심

## 2. 기본 화면

```text
┌────────────────────────────────────────────────────┐
│ [사람 OTC] [마이크 OFF/고지됨] [지식 2026.07...] │
├────────────────────────────────────────────────────┤
│ 검색/전사:  기침 3일, 62세, 혈압약              │
├────────────────────────────────────────────────────┤
│ 지금 말할 문장                                    │
│ “먼저 숨이 차거나 흉통, 고열이 있는지 확인할게요.”│
├────────────────────────────────────────────────────┤
│ 다음 질문 ①  “숨이 차거나 가슴이 아프신가요?”   │
├────────────────────────────────────────────────────┤
│ [위험 신호] [확인할 약] [피할 것]                │
├────────────────────────────────────────────────────┤
│ 후보: 감기 기침 | 알레르기 | 의뢰 필요           │
└────────────────────────────────────────────────────┘
```

## 3. 정보 계층

### Level 0 — 항상 보임

- mode/domain
- 입력 상태
- say-now
- ask-next
- red-flag banner
- freeze/clear

### Level 1 — 한 번 클릭/키

- missing slots
- actions/avoid
- 후보 카드 3개
- 제품/성분 확인
- confidence가 아니라 “확정/잠정/확인 필요” 인간 친화 배지

### Level 2 — 상세

- source/claim/검증일/만료일
- 계산 trace
- 제품 공식 정보 link/locator
- 카드 변경 이력

## 4. 핵심 컴포넌트

### InputBar

- `/`로 포커스
- IME composition 지원
- typed/voice transcript를 같은 필드에 보여주되 원본/정규화는 구분
- PII를 감지하면 화면상 마스킹 선택 제공
- clear button은 세션 메모리도 삭제

### MicControl

- 기본 push-to-talk: Space hold 또는 큰 버튼
- 상태: unavailable / ready / listening / reconnecting / blocked
- 환자 고지 완료 체크 또는 약국 설정에 따른 고지 UX
- listening 때 화면 전체에서 명확한 표시
- hands-free 플래그는 기본 숨김

### SayNowCard

- 최대 2줄 우선, 필요 시 3줄
- 큰 글자
- “그대로 말하기” 문구만
- provisional이면 잠정 표시
- refined update는 부드럽게 diff, 위치 고정

### AskNextCard

- 기본 하나만 크게
- Enter로 슬롯 입력 모드
- 이미 답한 질문은 사라지고 다음으로 이동
- 질문 이유는 작은 보조 텍스트

### RedFlagBanner

- 화면 최상단 고정
- 일반 카드보다 우선
- 명확한 행동 동사
- 확인 전에는 제품 추천 영역 숨김
- Esc로 무심코 닫히지 않음

### CandidateChips

- 1/2/3 단축키
- 서로 구분되는 intent 이름
- 각 후보의 결정 질문 한 줄
- 모델 confidence 숫자를 과신하게 하지 않고 상대적 상태로 표현

### FreezeControl

- `F` 또는 클릭
- 환자와 말하는 동안 새 transcript가 메인 카드를 바꾸지 못함
- 입력은 백그라운드로 수집 가능하지만 별도 “업데이트 있음” 배지
- unfreeze 시 현재 입력으로 재평가

### SourceBadge

- `공식 확인`, `검수됨`, `만료 임박`, `확인 필요`
- source 상세는 펼침
- 모델명보다 knowledge/source status가 더 중요하게 보임

## 5. 키보드

| 키 | 동작 |
|---|---|
| `/` | 입력 포커스 |
| `Space` hold | push-to-talk(입력 포커스 밖에서) |
| `Esc` | 비위험 일반 입력 clear 또는 modal 닫기 |
| `1` `2` `3` | 후보 intent 선택 |
| `Enter` | 다음 질문/선택 확정 |
| `F` | freeze/unfreeze |
| `R` | 보정 요청 |
| `S` | source 상세 |
| `Ctrl/Cmd+K` | 명령 팔레트 |

브라우저/IME 충돌을 테스트하고 사용자 설정으로 변경 가능하게 한다.

## 6. 상태 표현

- `provisional`: “듣는 중 · 잠정”
- `stable`: “입력 기준 일치”
- `blocked`: “필수 확인 전 안내 제한”
- `escalate`: “일반약 선택 중단”
- `offline`: “오프라인 카드 사용 중”
- `refinement pending`: 작은 spinner; 메인 카드 유지
- `stale pack`: 고위험 카드 제한, 업데이트 필요

## 7. 화면 흔들림 방지

- 메인 카드 높이 최소 고정
- 새 후보는 fade/indicator, 전체 레이아웃 재배치 금지
- same intent slot update는 문장 일부만 갱신
- 위험신호 외에는 자동 focus 이동 금지
- 새 모델 결과가 오더라도 약사가 freeze/선택한 카드는 덮어쓰지 않음

## 8. 문장 스타일

- 한 문장 평균 25~55자 목표
- 전문용어는 필요할 때 괄호로 한 번 설명
- “확인하겠습니다”, “먼저 여쭤볼게요”처럼 자연스러운 한국 약국 말투
- 환자 비난·명령조 최소화
- 진단 단정 대신 상태 확인/의뢰
- 한 번에 질문 하나
- 제품 광고 문구 금지

## 9. 접근성

- WCAG 2.2 AA 수준 목표
- 위험도를 색만으로 표현하지 않음
- 최소 글자 크기와 확대 대응
- screen reader label
- focus visible
- reduced motion
- 고대비 모드
- 음성 기능 없이 완전 사용 가능

## 10. 개인정보 UX

- 마이크 켜짐을 숨기지 않음
- 원문 저장 안 함을 명확히 표시하되 실제 구현과 일치
- “대화가 외부 AI API로 실시간 처리될 수 있음”에 대한 적절한 고지/동의 문안은 법무 검토
- session end 시 `대화 내용 지움` 상태 표시
- 피드백에는 환자 내용을 쓰지 않도록 UI 자체가 자유 텍스트를 기본 제공하지 않음

## 11. 오류 UX

- 모델 timeout: “문장 보정은 지연됨 · 기본 카드 사용”
- 음성 실패: “마이크 연결 실패 · 바로 입력하세요”와 input focus
- no match: 빈 추측 대신 후보 카테고리/한 가지 확인 질문
- source expired: “이 항목은 최신 확인이 필요하여 구체 안내를 제한합니다.”
- product ambiguity: 제품 사진 자동 추정 대신 제품명/라벨 입력 요청

## 12. 관리자 UI

카운터 UI와 분리한다.

- source/claim/card list
- diff/locator/evidence panel
- conflict queue
- expiry queue
- reviewer action with two-person approval option
- pack build/test/sign/publish/rollback
- no patient session content

## 13. 사용성 평가

현장 약사에게 다음을 측정한다.

- 첫 화면만 보고 다음 발화 가능 여부
- glance time
- wrong-card 수정 횟수
- 질문 순서 만족도
- alert fatigue
- 화면 흔들림/주의 분산
- 키보드 이용률
- 환자와 시선 접촉 방해

정확성뿐 아니라 업무 흐름을 해치지 않는지가 release 조건이다.
