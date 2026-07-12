# 13. Legal, Privacy, and Regulatory Notes — Korea

> 법률 의견서가 아니다. 실제 배포 전 대한민국 개인정보·의료·약사·디지털의료제품 분야 전문가, 보험자, 계약 담당자의 검토가 필요하다.

## 1. 개인정보/민감정보

환자의 증상, 복용약, 임신·수유, 질환 정보는 건강에 관한 민감정보가 될 수 있다. 음성에는 성문, 이름, 연락처, 동행인 정보, 다른 고객 대화가 포함될 수 있다.

설계에 반영할 원칙:

- 처리 목적을 명확히 하고 필요한 최소 정보만
- 건강정보 처리의 적법 근거와 별도 동의 필요 여부 검토
- 수집·이용·처리위탁·국외 이전 고지
- 보유기간 최소화
- 정보주체 권리 절차
- 접근통제·암호화·접속기록·침해 대응
- CPO/책임자 중심의 governance

개인정보보호위원회의 생성형 AI 안내서는 서비스형 LLM API 활용을 별도 유형으로 다루므로 개발·운영 생명주기에 반영한다.

## 2. 음성 캡처

통신비밀보호법상 대화 당사자의 녹음과 제3자의 타인 간 대화 녹음은 구분될 수 있으나, 합법적 녹음 여부와 개인정보 처리의 적법성은 같은 문제가 아니다. 약국에서 시스템이 주변 대화를 상시 수집하면 환자·동행인·다른 고객의 민감정보까지 처리할 위험이 있다.

따라서 제품 기본값:

- silent always-listening 금지
- push-to-talk
- 명확한 마이크 상태
- 환자에게 적절한 고지/동의 UX
- 다른 고객 대화가 들어오지 않게 물리적/운영 통제
- raw audio 저장 금지
- 상담 종료 즉시 session memory 삭제

hands-free를 제공하려면 별도 영향평가와 법률 검토를 요구한다.

## 3. OpenAI API 처리

OpenAI 공식 데이터 통제 문서를 기준으로 endpoint별 보존·abuse monitoring·application state·ZDR/MAM 적격 여부를 계약 시점에 다시 확인한다.

필수 설정/검토:

- Responses `store:false`
- background mode off
- persistent Conversations/vector stores/files에 patient data 미사용
- prompt/output data sharing 설정 확인
- Realtime의 retention/ZDR 가능 여부 확인
- DPA, subprocessors, data residency/cross-border transfer
- organization/project별 data controls
- 로그/observability vendor로의 재전송 차단

`store:false`는 모든 endpoint의 모든 로그를 0으로 만드는 범용 스위치가 아니다. Realtime과 abuse monitoring 조건을 별도로 검토한다.

## 4. 가명처리/비정형 데이터

음성·텍스트는 이름을 삭제해도 재식별 위험이 남을 수 있다. 개인정보위의 비정형 데이터 가명처리 가이드에 따라 처리 목적, 환경, 민감도, 재식별 가능성을 종합적으로 평가한다.

본 시스템은 학습용 raw 상담 축적을 기본 기능으로 두지 않는다. 모델 개선이 필요하면:

1. 별도 목적/근거/동의 검토
2. de-identification
3. 최소 샘플
4. 제한 환경
5. reviewer 접근통제
6. 재식별 위험 평가
7. 보유기간/삭제
8. 외부 모델 제공 여부 별도 결정

## 5. 출처·저작권

첨부 자료는 외부 반출/무단 복제 제한 신호가 있다. GitHub와 배포물에는 원본·스캔·장문 인용을 넣지 않는다. 실무 아이디어를 독립적으로 구조화하고, 임상 사실은 공식/허가된 출처로 다시 구축한다.

- private repo라도 사용권을 확인
- 원본을 OpenAI Files/vector store에 업로드하기 전 권리 검토
- 카드 문구가 원문 표현을 과도하게 복제하지 않게 검수
- source locator는 내부 접근권한이 있는 reviewer만

## 6. 약사 업무와 책임

제품의 intended use를 명확히 한다.

- 면허 약사의 상담 보조
- 최종 판단·설명은 약사
- 진단·처방·자동 조제 지시 아님
- 공식 허가사항/DUR/약력 확인을 대체하지 않음
- 환자 직접 사용 금지

그러나 단순 disclaimer로 책임이 사라지지 않는다. UI, 알고리즘, 검수, incident process가 intended use와 일치해야 한다.

## 7. 디지털의료제품/의료기기 해당성

대한민국 디지털의료제품법은 독립형 소프트웨어를 포함한 디지털의료기기 개념을 규정한다. 본 제품이 환자별 건강정보를 분석해 진단·치료 결정을 직접 제시한다고 표현하거나 기능을 확장하면 규제 대상 가능성이 커질 수 있다.

배포 전 확인:

- intended use/마케팅 문구
- 환자별 임상 의사결정 영향
- 약사의 독립적 검토 가능성
- 투명한 근거 제공 여부
- 자동화 수준
- 의료기기/디지털의료·건강지원기기 분류
- 품질관리·보안·임상적 성능 요구

식약처 사전상담 또는 규제 전문가 검토를 권장한다. “약사용 참고도구”라고 이름 붙이는 것만으로 자동 제외되는 것은 아니다.

## 8. 공식 의약품/DUR 데이터

MFDS 의약품안전나라와 HIRA DUR은 중요한 공식 근거다. 다음을 별도 확인한다.

- 공개 API/파일 제공 범위
- 이용약관/공공데이터 라이선스
- 업데이트 주기
- 복합제/대표성분 한계
- 삭제/취하 제품 처리
- 실시간 DUR 환자별 점검과 공개 기준 데이터의 차이
- 약국 기존 DUR 시스템과의 중복/오해

본 제품이 “DUR 확인 완료”라고 표시하려면 실제 승인된 DUR integration 결과여야 한다. 자체 중복 검색을 DUR과 동일하다고 표현하지 않는다.

## 9. 개인정보 영향평가 체크리스트

- 어떤 음성이 누구의 것인가
- 환자 고지/동의는 언제/어떻게 하는가
- 다른 고객의 발화가 들어오는가
- 브라우저→OpenAI/서버 데이터 흐름
- 각 processor/subprocessor와 국가
- 저장/로그/백업/모니터링 위치
- 계정/권한/퇴사자 처리
- 환자 요청 시 열람/삭제 가능 범위
- 사고 시 통지/대응
- model provider 변경 절차
- analytics/feedback에 health data가 남는가

## 10. 출시 전 필수 승인 문서

- intended use와 금지 용도
- data flow diagram
- 개인정보 처리방침/동의·고지 문안
- 위탁/국외 이전/DPA 검토
- retention schedule
- threat model/security controls
- source licensing register
- clinical safety case
- regulatory classification memo
- incident and rollback SOP
- pharmacist training/competency material

## 11. 공식 참고

`references/OFFICIAL_REFERENCES.csv`에 기준일 현재 사용한 공식 문서 URL을 정리했다. 법령·모델·데이터 정책은 변할 수 있으므로 출시/갱신 시 다시 확인한다.
