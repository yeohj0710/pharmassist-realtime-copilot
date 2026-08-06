# Codex 수집 루프 프롬프트

Codex에 그대로 붙여넣는 지시문이다. 한 회차가 끝나면 같은 프롬프트로 다시
시작하면 되고, 상태는 저장소 파일이 들고 있으므로 대화가 끊겨도 이어진다.

운영 규칙(속도·중단 조건·하면 안 되는 일)은 `UNATTENDED_COLLECTION_GUIDE.md`,
활성화 절차는 `DATA_SOURCE_ACTIVATION.md`에 있다. 아래 프롬프트는 그 둘을
읽으라고 지시하며, 여기서 내용을 되풀이하지 않는다.

---

## 붙여넣을 프롬프트

```text
너는 C:\dev\pharmassist-realtime-copilot 저장소에서 공식 의약품 데이터를
수집·정규화하는 작업자다. 한 회차만 수행하고 보고한 뒤 끝낸다.

## 시작 전 반드시 읽을 것
1. app/AGENTS.md — 기능 축소 금지, 자기승인 금지
2. docs/UNATTENDED_COLLECTION_GUIDE.md — 속도 손잡이, 중단 조건, 금지 목록
3. docs/DATA_SOURCE_ACTIVATION.md — 출처와 활성화 절차

이 세 문서가 이 프롬프트보다 우선한다. 충돌하면 문서를 따르고 보고에 적는다.

## 지금 상태 (2026-08-06 기준)
- 서비스키 4개는 app/.env에 있고 활용신청 4건 모두 승인됨
- e약은요 전량 수집 완료: data/mfds-otc-candidate/catalog.jsonl 4,757건
- 팩: 제품 234, 성분 등록 176, 프로토콜 44, 옵션 337
- 미등록 성분 id 210개, registry 776건 중 팩 반영 207건
- 약사 검토 큐 179건, 검토 완료 0건

## 이번 회차에 할 일
아래 순서로 훑고, 아직 안 된 것 중 맨 위 하나만 한다. 여러 개를 한꺼번에
하지 않는다.

A. 허가정보 전량 수집
   getDrugPrdtPrmsnDtlInq06으로 42,971건을 받아
   data/mfds-permit-candidate/ 에 catalog.jsonl + manifest.json으로 쓴다.
   기존 sync 스크립트(scripts/sync-mfds-otc-catalog.ts)와 같은 모양을 따르고,
   SourceSnapshot 필드를 빠짐없이 채운다. 원본 응답은 남기지 않는다.

B. DUR 7종 수집
   DURIrdntInfoService03의 7개 오퍼레이션을 각각 받아 유형별로 저장한다.
   getUsjntTabooInfoList02(병용금기), getPwnmTabooInfoList02(임부금기),
   getCpctyAtentInfoList02(용량주의), getMdctnPdAtentInfoList02(투여기간주의),
   getOdsnAtentInfoList02(노인주의), getSpcifyAgrdeTabooInfoList02(특정연령대금기),
   getEfcyDplctInfoList02(효능군중복).

C. 빈 적응증 채우기
   팩에서 indication_summary가 비었거나 없는 제품을 찾아, e약은요/허가정보의
   공식 원문으로 채운다. 원문을 요약하거나 바꿔 쓰지 않고 그대로 넣는다.
   출처를 SourceSnapshot으로 건다.

D. 미등록 성분 210개 등록
   제품이 참조하는데 pack.ingredients에 없는 성분 id를 공식 성분명으로
   등록한다. 이름을 지어내지 않는다. 공식 데이터에서 못 찾으면 그 건은
   건너뛰고 목록에 남긴다.

E. 크로스워크 후보 제안
   healthkr-legacy-match-report.json의 실패 21건과 같은 item_seq 38쌍에 대해
   근거(제조사·성분·제형·허가번호 일치 여부)를 붙여 제안 목록만 만든다.
   확정하거나 official_match_status를 바꾸지 않는다.

F. 차이 표 만들기
   같은 증상 경로 안 제품들의 성분·함량·제형·적응증을 허가원문에서 뽑아
   표로 정렬한다. 문장은 쓰지 않는다.

## 속도
app/.env의 COLLECT_* 값을 읽어서 지킨다. 없으면 기본값은
BATCH_SIZE=20, INTERVAL_HOURS=1, DAILY_CAP=200, ITEM_DELAY_MS=9000,
JITTER_PCT=35다. 이 값을 스스로 올리지 않는다. 공식 API는 provider 정의의
requestsPerSecond(3)를 따른다.

## 절대 하지 말 것
- 카드 문구(choose_when, comparison_note, differentiators) 생성·수정
- verified, published, pharmacist_reviewed를 true로 변경
- clinicalUseProhibited 해제
- 공식 레지스트리에 없는 제품·성분을 만들어 채우기
- 생성된 팩 JSON을 손으로 수정 (생성 파이프라인을 고친다)
- 테스트나 빌드 가드를 느슨하게 고쳐 실패를 지우기
- 약학정보원(health.kr) 등 계약 없는 출처 수집
- 서비스키를 로그·커밋·보고에 출력

## 회차 마무리
1. pnpm data:build:pack
2. pnpm build && pnpm test && pnpm typecheck && pnpm schema:check
3. 전부 초록이면 커밋하고 push한다. 하나라도 빨간불이면 커밋하지 않고
   실패로 보고한다.
4. 팩이 바뀌었으면 corepack pnpm deploy:web 까지 한다.

## 중단 조건
하나라도 걸리면 그 회차를 멈추고 사람에게 보고한다.
- 같은 실패가 3회 반복
- 스키마 불일치, 해시 불일치
- 응답 필드가 코드가 기대하는 모양과 다름
- 팩 기준선(claims 483 / protocols 44 / options 337)이 예고 없이 변동
- 약사 검토 큐가 250건 초과

## 보고 형식
- 이번 회차에 한 항목 (A~F 중 하나)
- 처리 건수: 성공 / 실패 / 건너뜀
- 새로 채워진 필드 수
- 실패 사유 상위 3개
- 사람이 직접 열어 볼 표본 10건 (제품명과 확인할 지점)
- 게이트 결과와 커밋 해시
- 다음 회차에 할 항목
```

---

## 사람이 매 회차 확인할 것

보고서의 **표본 10건**만 열어 보면 된다. 게이트가 전부 초록이어도 내용이
틀릴 수 있다. 이전 코퍼스 작업에서 모든 게이트를 통과한 산출물에 결함이
있었다.

큐가 250건에 가까워지면 수집을 멈추고 검토를 먼저 돌린다. 검토되지 않은
문구는 자산이 아니라 부채다.
