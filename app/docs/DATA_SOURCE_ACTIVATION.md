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

## 전체 OTC 후보 카탈로그 동기화

`.env`에 `MFDS_EASY_DRUG_SERVICE_KEY`를 설정한 뒤 다음 명령을 실행한다.

```powershell
pnpm data:sync:mfds-otc
```

결과는 `data/mfds-otc-candidate/catalog.jsonl`과 `manifest.json`에 원자적으로 갱신된다. 이 카탈로그는 공급실적이 있는 일반의약품의 공식 후보 모집단이며 `candidateOnly=true`, `clinicalUseProhibited=true`를 유지한다. 제품 수집만으로 상담 추천을 활성화하지 않는다. 성분 교차연결, DUR 배제, 프로토콜 적합성 및 약사 검토를 모두 통과한 제품만 실행 팩으로 승격한다.

## 비공개 약국 취급 SKU 후보 가져오기

약국 취급 SKU 원본은 외부 로컬 저장소에서 읽고 PharmAssist 저장소로 복사하지 않는다. 소스 경로는 `PHARMACY_CATALOG_SOURCE_DIR`에 설정하거나 명령 인자로 전달한다.

```powershell
pnpm data:import:local-catalog --source C:\path\to\pharmacy-product-catalog
pnpm data:import:local-catalog --source C:\path\to\pharmacy-product-catalog --write
```

첫 명령은 파일을 만들지 않고 집계만 출력한다. `--write`를 추가하면 최소 파생 후보를 저장소 루트의 고정 경로 `etc/pharmacy-product-catalog-candidate/`에만 쓴다. 다른 출력 경로는 허용하지 않는다. 생성 파일은 Git에서 제외되며 웹 앱의 `data/` 또는 `public/`에 들어가지 않는다. 카탈로그와 보고서 해시가 든 manifest를 마지막에 바꿔 세 파일이 같은 세대인지 확인할 수 있게 한다.

후보에는 정규화한 제품명·규격, 원본 SKU ID, 원본 분류, 확인일과 출처 해시만 포함한다. 표시 가격, 현재가, 재고, POS 판매량과 판매순위는 가져오지 않는다. 원본 분류는 진열·증상 분류이므로 공식 의약품·건강기능식품 구분으로 간주하지 않는다. `코스메틱`과 `의료기기` 외 항목은 가능한 공식 데이터 영역만 정하고 검토 대상으로 남긴다.

기존 실행 팩과 이름이 같다는 사실은 소매 SKU와 공식 품목의 일치 증거가 아니다. 이름이 정확히 같은 후보와 제형 접미사만 다른 후보를 각각 교차검토 힌트로 기록하지만 `officialMatch.status=required`, `formularyEligible=false`를 유지한다. 다음 조건을 모두 확인한 제품만 별도 승격 절차에서 실행 formulary에 추가한다.

1. 식약처 품목기준코드와 일반의약품 구분을 공식 레코드로 확인한다.
2. 허가 상태, 주성분과 DUR 배제 규칙을 연결한다.
3. 제품별 효능 근거를 상담 protocol option과 연결한다.
4. 안전 규칙과 제품 연결을 약사가 검토한다.

## 로컬 약학정보원 enrichment registry 가져오기

`data/products.json` 기반 `data:import:local-catalog` 산출물은 규제 영역을 분류하는 비공개 초기 후보일 뿐이다. 공식 매칭·화면 표시·상담 추천에는 사용하지 않는다.

이미 수집된 카탈로그를 다시 크롤링하지 않고 정규 registry로 변환한다. 표시·공식 상태·구조화 본문은 재사용 계약에 따라 `data/portable/v1/products.json`을 권위 소스로 사용한다. `data/enrichment-queue.json`은 portable에 없는 DUR·상호작용·보험·동일성분 등 확장 필드만 같은 `product_id`로 보강한다. 원본 저장소는 읽기 전용으로 두고 다음 명령을 실행한다.

```powershell
pnpm data:import:healthkr-registry --source C:\dev\pharmacy-product-catalog
node scripts/build-actual-preview-pack.mjs
```

첫 명령은 portable manifest의 products/schema SHA-256을 확인하고 portable 776건과 enrichment 776건의 SKU·교정 상품명·규격·가격·공식 상태를 1:1로 대조한다. 모든 입력과 생성 registry가 각 JSON Schema를 통과한 뒤에만 `data/healthkr-product-registry/`의 `registry.json`, `report.json`, `manifest.json`을 교체한다. manifest에는 portable·enrichment·재사용 계약·교정 근거·registry·report SHA-256과 같은 세대의 집계가 들어간다. `pack.mappingContentSha256`은 순환 의존을 피하기 위해 최종 `pack.json` 전체가 아니라 성분·protocol option 매핑 입력의 정규 투영을 결속한다. 생성 파일에는 원본 절대경로, `health_kr_raw`, 잘못 명명된 신고번호·표준코드 필드, 페이지 전문을 넣지 않는다.

registry는 776개 소매 SKU의 교정된 상품명·용량·규격·표시 가격·이미지 출처를 공식 품목과 분리해 보존한다. `app_*` 필드는 원본 저장소의 감사 추적용으로만 남기고 registry·실행 팩·UI에 복사하지 않는다. 표시는 조회일 당시 가격 스냅샷이며 재고·현재가·판매량·판매순위가 아니다. 공식 품목 식별에는 `official_item_seq`와 같은 값인 `official_product_key`, 해당 `drug_cd`를 포함한 출처 URL만 사용한다. 바코드·표준코드가 없는 경우 이름 유사도로 대체하지 않는다.

실행 팩 승격은 다음 조건을 모두 통과한 행으로 제한한다.

1. `official_match_status=confirmed`이고 품목 키와 HTTPS `health.kr/searchDrug/result_drug.asp?drug_cd=...` 출처 URL이 정확히 일치한다.
2. 약학정보원 원본 분류가 일반의약품이고 허가 취소일과 매칭 충돌이 없다.
3. 모든 유효성분이 현재 지식팩 성분과 정확한 별칭으로 연결된다.
4. 연결된 모든 성분이 같은 protocol option에 속하고, 효능·제형·투여경로가 protocol 규칙과 일치한다.
5. 추천 시점에 연령·임신·알레르기·복용약·상호작용·DUR 규칙을 다시 적용한다.

`review_required`, `not_found`, `not_applicable` 행은 registry에 남지만 formulary에 자동 추가하지 않는다. 연구 미리보기의 `pharmacist_approved=false`도 유지하며, confirmed 연결을 실제 약사 승인으로 표시하지 않는다.

## Provider별 역할

- **MFDS e약은요**: 공급실적이 있는 OTC 모집단과 효능·사용법·주의사항·상호작용·부작용·보관법 candidate.
- **MFDS 제품 허가정보 Service07**: 품목기준코드, 성분, 업체, 제형, 허가상태 정규화.
- **MFDS DUR 품목/성분**: 차단·금기·중복·연령·임신 등 exclusion candidate. 자동 추출만으로 production rule을 만들지 않는다.
- **Tenant POS/inventory**: tenant SKU crosswalk, 재고, 최근 90일 비식별 판매 집계. 임상 source가 아니며 recommendation evidence ref로 사용하지 않는다.
- **약학정보원/Health.kr**: 공개 페이지 crawler를 구현하지 않는다. API Center/제휴 계약에서 commercial use, cache, derived data, redistribution, AI-context 권한이 모두 서면 승인된 경우에만 별도 optional adapter를 활성화한다.

## 연구 미리보기 치료 적합도와 제품 근거

원본 candidate는 수정하지 않는다. `data/actual-research-overlays/therapeutic-fit.json`은 현재 47개 protocol option을 모두 `preferred`, `alternative`, `conditional` 중 하나로 분류하고 근거 범위와 판단 이유를 기록한다. 팩 생성기는 일부 증상만 예외 처리하지 않고 다음 조건을 모든 option에 적용한다.

- 원본 option 전체가 정확히 한 번 분류되어야 한다.
- 알 수 없는 option, 중복 분류, 빈 판단 이유가 있으면 팩 생성을 중단한다.
- `candidate_only=true`, `clinical_use_prohibited=true`를 유지한다.
- 추천 엔진은 치료 역할과 근거 범위를 먼저 비교하고 안전 우선순위와 기존 임상 점수는 그다음에 비교한다.
- `conditional` option은 표현형 선택 규칙이 명시적으로 고른 경우에만 결과에 포함한다.

제품 카탈로그 등록과 증상별 추천 자격은 별개다. 제품 실행 후보는 공식 제품 등록, 활성 상태, 성분 link, protocol option, tenant formulary뿐 아니라 현재 option의 indication claim에 제품 ID가 직접 포함되어야 한다. 같은 단일 성분이라는 이유만으로 다른 제품을 추가하지 않는다.

`supply_performance`는 공개 공급실적 표시일 뿐 허가 유효성, 약국 formulary, 재고 또는 판매순위가 아니다. 실제 재고는 tenant inventory가 연결된 경우에만 적용한다. 최근 90일 판매순위는 임상 적합도, 안전성, 재고가 같은 후보의 마지막 동률 해소에만 사용한다. 치료 역할 분류와 로컬 formulary는 연구 미리보기 후보이며 실제 약사 승인으로 간주하지 않는다.

## 장애 처리

- HTTP 408/425/429/5xx는 제한된 exponential backoff와 `Retry-After`를 적용한다.
- page limit, result code 오류, schema drift, hash mismatch는 snapshot을 failed로 기록하고 현재 active pack을 유지한다.
- provider 장애 중에는 새 candidate pack을 만들지 않으며 기존 서명 pack의 만료 전까지만 runtime을 유지한다.
