# book1 근거층 — 진행 보고

『약사들의 친절한 복약 안내서』(인천광역시약사회, 초판 1쇄 2026-05-30,
ISBN 979-11-995930-4-6)를 actual-candidate-pack의 근거층으로 붙이는 작업.

**이 문서의 모든 항목은 승인 전 상태다.** 어떤 claim도 published가 아니고
`pharmacist_approved` / `official_source_verified`는 전부 false이며, 팩의
`verified` / `clinicalUseProhibited` 플래그는 건드리지 않았다. 승인은 사람이
`apps/reviewer`에서 한다.

## 1. 완료: 소스 등재

| 항목                 | 값                                                                 |
| -------------------- | ------------------------------------------------------------------ |
| `source_id`          | `SRC-BOOK1-BOGYAK`                                                 |
| `source_snapshot_id` | `SNAP-BOOK1-BOGYAK-20260530`                                       |
| `official`           | **false**                                                          |
| `source_url`         | `urn:isbn:9791199593046`                                           |
| `effective_at`       | 2026-05-30 (초판 1쇄)                                              |
| `content_sha256`     | `897878968cf59432111fee597a55e56d8894830c26c5d2961db6be43b7c7a150` |
| 코퍼스               | 91개 md 파일, 페이지 317, qa 410건                                 |

`content_sha256`은 전사 코퍼스 전체(파일명 + 본문, 개행 정규화, 파일명 정렬)의
결정적 해시다. 인쇄물 자체의 해시가 아니며, 코퍼스가 바뀌면 검증에서 드러난다.

팩 규모: sources 50 → **51**. claims 704, protocols 26, protocolOptions 558은
변동 없음(병합 스크립트가 쓰기 전에, 검증 스크립트가 쓴 뒤에 각각 확인).

### 판단이 필요했던 두 가지

**`official: false`.** 약사 저작 단행본은 전문가 권위이지 규제 근거가 아니다.
식약처 허가사항처럼 인용되면 안 되므로 false로 두었고, 소스 레코드의
`uncertainty`에 그 취지를 한국어로 명시했다.

이 때문에 `actual-pack.test.ts`의 "모든 소스는 official" 단언이 깨졌다. 테스트를
느슨하게 푸는 대신, **비-official 소스를 이름으로 못 박는** 단언으로 바꿨다
(`toEqual(["SRC-BOOK1-BOGYAK"])`). 두 번째 비-official 소스가 조용히 들어오면
이제 실패한다 — 기존보다 강한 검사다.

**`source_url`.** 저장소가 자체 정의한 `uri` 포맷이 hostname을 요구해서
`urn:isbn:`을 거부했다(`packages/contracts/src/validators.ts`). 종이책에는 host가
없고 ISBN이 유일한 식별자다. 그럴듯한 웹 주소를 지어내는 대신 검증기를 고쳤다:
**http/https는 여전히 host를 요구**하고(반쯤 쓰다 만 URL이 출처로 기록되는 것을
막는 검사), 그 외 스킴은 자기 식별자를 갖는다. 회귀 테스트 2건 추가.

**HTTP로 가져온 자료가 아니다.** 스키마가 `http_status`를 요구하지만 요청은 없었고,
그 사실을 `uncertainty`에 적어 200이 요청을 뜻하지 않도록 했다.

## 2. 완료: 도구와 검증

- `tools/ingest/src/book1-bogyak.ts` — 챕터를 인쇄 페이지 앵커 단위로 분해.
  claim은 **코퍼스에 실재하는 페이지만** 인용할 수 있다. 테스트 8건.
- `scripts/book1-merge.mjs` — 멱등 병합. 기존 claim/protocol/option 수를
  **쓰기 전에** 확인하고 어긋나면 던진다. corroboration은 기존 claim의
  `source_refs`에 인용만 덧붙이고 내용·상태·위험도는 건드리지 않는다.
- `scripts/book1-check.mjs` — 기계적 검증. 자기승인(published/verified/approved),
  빈 인용, 코퍼스에 없는 페이지 인용, 저작권 필드가 unknown이 아닌 경우,
  `pack.verified` 변조를 전부 실패로 잡는다.

현재 실행 결과: `failures: 0`, carried_claims 704, protocols 26, options 558.

## 3. 미완: claim 추출

**아직 0건이다.** 파이프라인은 준비됐고 데이터가 없다.

qa.jsonl 410건은 전부 페이지를 갖고 있어 인용 요건은 충족한다. 어휘 신호로 1차
분류를 재보면 195건은 claim_type이 잡히고 **215건은 신호가 없다**:

| claim_type               | 건수    |
| ------------------------ | ------- |
| indication               | 87      |
| interaction              | 34      |
| referral                 | 26      |
| adverse_effect           | 16      |
| administration           | 11      |
| contraindication         | 10      |
| red_flag                 | 6       |
| monitoring               | 5       |
| **신호 없음(보류 후보)** | **215** |

`gist`는 중앙값 42자짜리 요약이라 그것만으로 임상 claim을 세우기엔 얇다. 실제
추출은 챕터 본문의 해당 답변 구간을 원문 그대로 옮기는 방식이어야 한다.

### 남은 설계 결정 — 이걸 정해야 추출이 진행된다

`clinical_claim` 스키마는 `subject_type`을 `ingredient | product | protocol | option`
넷 중에서만 받고 `subject_id`가 필수다. **book1 claim이 걸릴 subject가 없다.**
책의 주제("칼슘제", "무좀")는 팩의 성분·제품·프로토콜 어디에도 1:1로 대응하지 않는다.

선택지:

1. **book1 전용 프로토콜을 만들어 매단다** — 챕터당 하나면 protocol이 26 → 116이
   된다. 검증 기준("protocols 26 유지")과 정면으로 충돌한다.
2. **우산 프로토콜 하나**(`PRO-BOOK1-COUNSELING`)에 전부 매단다 — protocol 27.
   기준을 1건 늘리는 것으로 끝나지만, 프로토콜의 의미가 희석된다.
3. **성분에 매단다** — 책이 다루는 성분이 팩 `ingredients` 227건에 있는 경우에만
   claim을 만든다. 커버리지는 줄지만 모델이 깨끗하고, 근거층의 목적(기존 후보에
   출처를 붙이는 것)에 가장 맞는다. 나머지는 보류 목록으로 남는다.

세 번째가 이 팩의 목적에 가장 부합해 보이나, 커버리지를 얼마나 포기할지는
사람이 정할 문제라 임의로 진행하지 않았다.

## 4. 사람이 확인해야 할 것

- **저작권 범위.** `redistribution` / `commercial_use` / `ai_context_use` /
  `usage_rights` / `cache_policy` 전부 `unknown`이다. 발행처(인천광역시약사회)와
  확인 전까지 원문을 팩 외부로 내보내지 말 것. 저자 중 한 명이 이 프로젝트
  사용자라는 사실은 발행처의 권리와 별개다.
- **승인 대기 건수: 0.** 추출이 끝나면 위험도 높은 순 → 기존 지식과 충돌하는 순
  → 나머지 순으로 대기열을 만든다.
- **충돌 목록: 아직 없음.** 대조는 추출 이후 단계다.

## 5. 재현

```bash
npx turbo build --filter=@pharmassist/ingest
node scripts/book1-merge.mjs
node scripts/book1-check.mjs
```

코퍼스(`C:\dev\book-corpus`)는 읽기 전용이며 이 작업에서 수정하지 않았다.
