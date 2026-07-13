# Data source activation runbook

확인 기준일: 2026-07-13. 이 문서는 credential 없이 adapter 계약과 검증 절차를 준비한 것이며, 실제 MFDS 응답을 수신했다는 의미가 아니다.

## 환경변수

```text
MFDS_EASY_DRUG_SERVICE_KEY
MFDS_PERMIT_SERVICE_KEY
MFDS_DUR_PRODUCT_SERVICE_KEY
MFDS_DUR_INGREDIENT_SERVICE_KEY
MFDS_EASY_DRUG_OPERATION_PATH=getDrbEasyDrugList
MFDS_PERMIT_OPERATION_PATH=getDrugPrdtPrmsnDtlInq07
MFDS_DUR_PRODUCT_OPERATION_PATH=getDurPrdlstInfoList03
MFDS_DUR_INGREDIENT_OPERATION_PATH=getDurIrdntInfoList02
```

operation path는 코드 release 없이 override할 수 있어야 한다. 특히 `DrugPrdtPrmsnInfoService07`은 account-visible Swagger를 activation 당일 다시 확인한다. 요청 필드 `main_item_ingr`, 응답 필드 `TAMT_SEQ` 변경 공지를 parser fixture와 contract probe에 반영한다.

## Preflight

1. 공공데이터포털 활용신청 상태와 운영계정 심의를 확인한다.
2. portal URL, service base URL, operation path, 요청/응답 필드, pagination envelope를 Swagger와 대조한다.
3. 개발 credential로 1 page contract probe를 실행하되 raw body를 repo/일반 로그에 남기지 않는다.
4. JSON과 XML fixture parser, empty page, single-object item, retryable HTTP, API result code 오류를 테스트한다.
5. `SourceSnapshot`에 URL, 확인시각, terms URL, HTTP status, content SHA-256, parser version, row/page count, uncertainty를 기록한다.
6. 원본 payload는 기본 `raw_retention_policy=none`으로 폐기한다. 법적·운영상 보관 필요 시 별도 암호화 정책과 retention 승인을 받는다.
7. 자동 정규화 결과는 candidate로만 저장하고, claim/protocol published 전 약사 검토를 거친다.

## Provider별 역할

- **MFDS e약은요**: 공급실적이 있는 OTC 모집단과 효능·사용법·주의사항·상호작용·부작용·보관법 candidate.
- **MFDS 제품 허가정보 Service07**: 품목기준코드, 성분, 업체, 제형, 허가상태 정규화.
- **MFDS DUR 품목/성분**: 차단·금기·중복·연령·임신 등 exclusion candidate. 자동 추출만으로 production rule을 만들지 않는다.
- **Tenant POS/inventory**: tenant SKU crosswalk, 재고, 최근 90일 비식별 판매 집계. 임상 source가 아니며 recommendation evidence ref로 사용하지 않는다.
- **약학정보원/Health.kr**: 공개 페이지 crawler를 구현하지 않는다. API Center/제휴 계약에서 commercial use, cache, derived data, redistribution, AI-context 권한이 모두 서면 승인된 경우에만 별도 optional adapter를 활성화한다.

## 장애 처리

- HTTP 408/425/429/5xx는 제한된 exponential backoff와 `Retry-After`를 적용한다.
- page limit, result code 오류, schema drift, hash mismatch는 snapshot을 failed로 기록하고 현재 active pack을 유지한다.
- provider 장애 중에는 새 candidate pack을 만들지 않으며 기존 서명 pack의 만료 전까지만 runtime을 유지한다.
