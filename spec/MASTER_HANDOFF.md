# MASTER HANDOFF

**프로젝트:** 약사 실시간 복약상담 코파일럿  
**작성 기준일:** 2026-07-10  
**주요 시장/언어:** 대한민국, 한국어  
**사용자:** 약국 카운터의 면허 약사  
**구현 성격:** 자체 모델 학습이 아니라 OpenAI API를 감싼 로컬 우선형 애플리케이션

---

## 1. 최종 제품 정의

환자의 발화 또는 약사가 입력한 몇 개의 키워드를 받아, 약사가 화면을 한 번 보고 바로 말할 수 있는 다음 정보를 제공한다.

1. **지금 말할 문장** — 1~2문장, 환자에게 그대로 말할 수 있는 한국어
2. **다음에 물을 한 가지** — 임상적으로 정보가 가장 크게 늘어나는 질문 하나
3. **즉시 의뢰/응급 신호** — 해당 시 일반약 추천을 멈추고 행동을 전환
4. **검증된 안내/주의** — 성분·제품·용법·중복·금기 등, 승인된 claim만
5. **말하지 말 것** — 근거 없는 단정, 진단, 매출 중심 권유, 필수정보 없는 숫자

시스템은 상담의 최종 판단자가 아니라 **약사의 눈앞에서 작동하는 초저지연 컨닝 페이퍼**다. 환자-facing 챗봇, 자동 진단기, 자동 처방기, 판매 최적화 엔진이 아니다.

---

## 2. 첨부 자료 분석 결론

총 124개, 약 305MB, PDF 52개(1,730쪽), 이미지 70개, XLSX 1개, DOCX 1개를 확인했다. 텍스트 PDF는 전수 추출·구조 검토와 시각 샘플링을 했고, 이미지 중심 PDF와 이미지 묶음은 전체 시각 검토, 스프레드시트는 전체 시트/행, DOCX는 전체 본문/렌더링 페이지를 확인했다.

자료에서 가치가 높은 부분은 다음과 같다.

- 증상별 상담 순서, 짧은 현장 멘트, 환자에게 이해되는 표현
- 먼저 확인해야 할 위험 신호와 필수 질문의 구조
- 소아·임부·수유·고령자·현재 복용약을 놓치지 않는 슬롯 개념
- 조제/복약지도에서 짧고 빠르게 훑는 워크플로
- 감기·통증·위장·피부·여성·소아 등 카드 인벤토리의 주제 분류

그대로 사용하면 위험한 부분도 분명하다.

- 임상 안전보다 복합판매·업셀링을 앞세운 멘트
- 제품·학회·판매 조직의 판촉성 주장
- 외형·체질·‘기운’으로 건강 상태를 추정하는 비표준 분류
- 출처·최신성·제품별 차이를 확인하지 않은 영양소 용량·부작용·상호작용 표
- 사람 의약품과 동물약 자료의 혼재
- 제품별 허가사항이 필요한 피임약 누락 규칙, 소아 용량 등 고위험 규칙

따라서 원본은 **운영 RAG 코퍼스가 아니라 후보 카드 저작 자료**로만 쓴다. 파일별 판정은 `SOURCE_AUDIT.csv`에 있다.

---

## 3. 핵심 설계 결정

### 3.1 1초 목표를 달성하는 방법

완성형 LLM 답변을 매번 1초 안에 보장하는 것은 네트워크·모델 큐·발화 길이 때문에 현실적인 SLA가 아니다. 제품의 1초 정의를 다음과 같이 고정한다.

> **안정된 입력 신호가 생긴 시점부터 1초 안에 ‘첫 유용 상담카드’를 표시한다.**

이를 위해 2단계로 동작한다.

- **Instant path:** 브라우저 Web Worker에서 정규화 → 위험신호 → 슬롯 → exact/rule/BM25 검색 → 승인 카드 표시. 네트워크 호출 없음.
- **Refinement path:** 필요할 때만 구조화된 최소 컨텍스트를 OpenAI Responses API로 보내 문장을 다듬거나 애매한 후보를 정리하고 스트리밍 갱신.

타이핑 exact match 목표는 P95 250ms 이하, 음성은 ‘전사된 안정 prefix가 도착한 후’ P95 700ms 이하이다. 환자가 필요한 단어를 아직 말하지 않았거나 네트워크가 나쁜 상황까지 포함한 음성 end-to-end 1초는 보장 문구로 사용하지 않는다.

### 3.2 모델을 학습시키지 않는 이유

v1은 파인튜닝이나 자체 모델 학습을 하지 않는다.

- 의료 사실은 모델 가중치가 아니라 버전 관리되는 claim/card에 있어야 한다.
- 과적합이 필요한 부분은 모델 학습이 아니라 **좁은 intent 인벤토리, 별칭 사전, 규칙, 카드 컴파일**로 구현한다.
- 모델은 표현·요약·애매성 보조에만 사용한다.
- 충분한 약사 승인 gold 데이터가 쌓인 뒤에도 파인튜닝은 라우팅/스타일 후보일 뿐, 임상 사실 저장소가 아니다.

### 3.3 권장 OpenAI 역할 분담

- 실시간 음성 전사: `gpt-realtime-whisper`, 브라우저 WebRTC
- 짧은 문장 보정: `gpt-5.6-luna`, reasoning `none`, strict Structured Outputs, streaming
- 애매한 복합 질의: `gpt-5.6-terra`, reasoning `low`
- 오프라인 자료 구조화·충돌 분석: `gpt-5.6-sol`/alias `gpt-5.6`, 높은 추론 수준
- 전체 음성 에이전트: 기본 비활성. 필요 시 `gpt-realtime-2.1-mini`를 실험 플래그로만 사용

모델 ID는 설정값이어야 하며 코드 곳곳에 하드코딩하지 않는다. 검증된 후 snapshot 고정을 권장한다.

---

## 4. 절대 제약

1. **Triage before treatment.** 위험신호 검사는 추천보다 항상 먼저다.
2. **Missing data is a valid answer.** 필수 슬롯이 없으면 “먼저 이것을 물으세요”가 정답이다.
3. **No unverified numeric output.** 소아 mL, 용량, 기간, 복용 누락 계산은 공식 제품 데이터와 필수 입력 없이 숫자를 출력하지 않는다.
4. **No raw-source truth.** 첨부 자료의 C/D/X 등급 주장은 A/B 출처 검증 없이 운영 카드가 될 수 없다.
5. **No diagnosis.** 약사가 말할 상담/의뢰 문구를 제시하되 질환을 확정하지 않는다.
6. **No revenue optimization.** 판매액·마진·재고 소진이 임상 순위를 바꿀 수 없다.
7. **Domain isolation.** 사람 OTC, 처방 복약지도, 건기식, 동물약, 운영 자료를 분리한다. 기본은 사람 OTC만.
8. **No silent ambient surveillance.** 기본은 push-to-talk, 명확한 마이크 표시와 법적 고지/동의 검토.
9. **No raw audio/transcript logging.** 기본 저장·로그 금지. 외부 API 전 PII를 최대한 제거한다.
10. **Human authority.** 최종 판단과 발화는 약사가 한다. 고위험 출력은 약사 확인이 있어야 한다.
11. **Fail closed for high risk.** 지식 만료·공식 데이터 불일치·모델 오류 시 고위험 안내를 차단하고 확인/의뢰로 전환한다.
12. **Stale response protection.** 모든 요청에 sequence를 붙이고 뒤늦게 온 모델 결과는 폐기한다.

---

## 5. 시스템 구성 요약

```text
환자 발화 ─ WebRTC transcription ┐
                                 ├─ 입력 정규화/슬롯/부정어 ─ 안전 게이트 ─ 로컬 카드 검색 ─ 즉시 화면
약사 키워드 입력 ────────────────┘                                         │
                                                                              └─ 선택적 Responses API 보정

오프라인 원본 자료 ─ 후보 claim/card 추출 ─ 공식 출처 대조 ─ 약사 검수 ─ 서명된 불변 knowledge pack
```

브라우저에 승인된 compact knowledge pack을 캐시하고 Web Worker에서 검색하므로, OpenAI 장애·인터넷 장애에도 타이핑 기반 핵심 기능이 유지된다. 서버는 Realtime 세션 생성, Responses 보정, 지식 배포, coded feedback, 감사 이벤트를 담당한다.

---

## 6. 구현 순서

1. **Typed-only local MVP:** 카드 스키마, 안전 게이트, alias/rule/BM25, UI, 합성 데이터, 오프라인 모드
2. **검수 콘솔/지식 컴파일러:** source→claim→card→review→signed pack
3. **OpenAI refinement:** `store:false`, strict schema, streaming, timeout/fallback, redaction
4. **Realtime transcription:** push-to-talk, 부분 전사, 안정 prefix, ASR 대안, 마이크 고지
5. **공식 데이터 어댑터:** MFDS 제품정보, DUR 데이터의 승인된 방식/라이선스 범위 내 동기화
6. **처방·건기식 모드:** 별도 플래그·별도 카드팩·별도 검수
7. **현장 shadow pilot:** 약사는 기존 방식으로 상담하고 시스템 출력만 평가
8. **제한적 활성화:** 안전·지연·수용성 release gate를 통과한 카드만

단계별 완료 조건은 `codex/ACCEPTANCE_CRITERIA.md`에 있다.

---

## 7. 사용자 화면의 우선순위

화면 상단에는 항상 다음 순서로 보인다.

1. **지금 말할 문장**
2. **다음 질문 한 가지**
3. **위험 신호/의뢰**
4. **확인된 안내 및 주의**
5. **피할 표현**
6. 출처·검증일·knowledge version

긴 설명, 모델 추론 과정, 논문 요약, 원본 자료 문구는 카운터 화면에 노출하지 않는다. 상세 근거는 약사가 펼칠 때만 보이는 2차 패널에 둔다.

---

## 8. 성공 기준

- 타이핑 exact/rule 첫 카드 P95 ≤ 250ms
- 음성 안정 prefix 이후 첫 카드 P95 ≤ 700ms(정의된 네트워크 프로필)
- 중대한 위험신호 gold set recall ≥ 99.5%
- 필수 슬롯 누락 상태에서 고위험 숫자·규칙 출력 차단 ≥ 99.9%
- production pack의 미승인/만료/출처 불명 claim 0건
- 구조화 출력 schema validation 100%
- 뒤늦은 네트워크 응답이 현재 카드 덮어쓰기 0건
- raw audio/transcript 로그 0건(기본 설정)
- 약사 평가에서 “첫 화면만 보고 다음 발화 가능” 비율 목표 ≥ 90%

이는 초기 release target이며 실제 임상·운영 파일럿으로 조정한다.

---

## 9. 법률·규제 전제

건강정보는 민감정보이고 음성에는 식별 가능 정보가 포함될 수 있다. 마이크 고지/동의, 개인정보 처리 근거, 국외 이전/처리위탁, 보유기간, OpenAI 데이터 보존 옵션, 디지털의료제품/의료기기 해당 가능성을 한국 법률·규제 전문가와 검토해야 한다. 이 패키지는 법률 의견서가 아니다.

Responses API는 `store:false`를 기본으로 하고 background/conversation/vector store 같은 지속 상태 기능은 기본 금지한다. Realtime은 별도 데이터 통제 검토가 필요하며, 운영 전 OpenAI 조직의 ZDR/MAM 가능 여부와 계약 조건을 확인한다.

---

## 10. Codex에 넘기는 방법

`codex/MASTER_IMPLEMENTATION_PROMPT.md` 전체를 구현 에이전트의 첫 프롬프트로 전달하고, 이 폴더를 리포지토리 루트의 `spec/` 또는 작업 디렉터리에 둔다. Codex는 모든 문서와 스키마를 읽은 뒤 실제 동작하는 monorepo를 만들고, 테스트·벤치마크·Docker·문서까지 완료해야 한다.

중간에 선택지가 생겨도 질문을 되돌리지 말고 다음 우선순위로 결정하도록 프롬프트에 명시했다.

> 임상 안전 > 개인정보 > 정확성 > 첫 카드 지연시간 > 약사 사용성 > 비용 > 기능 수

---

## 11. 인계 산출물 체크

- 제품/기능/성능 요구사항: `docs/01_PRODUCT_REQUIREMENTS.md`
- 출처 신뢰 정책: `docs/02_SOURCE_AUDIT_AND_TRUST_POLICY.md`
- 아키텍처: `docs/03_SYSTEM_ARCHITECTURE.md`
- 데이터/스키마: `docs/04_DATA_MODEL_AND_SCHEMAS.md`, `schemas/`
- 자료 처리: `docs/05_INGESTION_PIPELINE.md`
- 지연시간/실시간 처리: `docs/06_REALTIME_RUNTIME_AND_LATENCY.md`
- 안전: `docs/07_SAFETY_GUARDRAILS.md`
- UI: `docs/08_UI_UX_SPEC.md`
- 평가: `docs/09_EVALUATION_AND_GOLDEN_TESTS.md`
- 배포/보안/관측: `docs/10_DEPLOYMENT_SECURITY_OBSERVABILITY.md`
- 구현 단계: `docs/11_IMPLEMENTATION_PLAN.md`
- API 계약: `docs/12_API_CONTRACT.md`
- 법률/개인정보: `docs/13_LEGAL_PRIVACY_NOTES.md`
- 자료 맵: `docs/14_SOURCE_CONTENT_MAP.md`
- 프롬프트: `prompts/`
- Codex 구현 지시: `codex/`
- 파일별 감사: `SOURCE_AUDIT.csv`
