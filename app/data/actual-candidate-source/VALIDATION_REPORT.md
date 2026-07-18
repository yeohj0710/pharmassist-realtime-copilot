# VALIDATION REPORT

- 기준일: `2026-07-13` (Asia/Seoul)
- Pack ID: `PACK-PHARMASSIST-KR-OTC-ACTUAL-20260713`
- 검증기: JSON Schema Draft 2020-12 + format checker, 추가 참조 무결성 검사

## 파일별 검증 결과

| 파일 | 레코드 수 | 스키마/계약 | 통과 행 | 실패 행 | 오류 수 |
|---|---:|---|---:|---:|---:|
| `source_snapshots.jsonl` | 39 | `source_snapshot.schema.json` | 39 | 0 | 0 |
| `ingredients.jsonl` | 31 | `ingredient.schema.json` | 31 | 0 | 0 |
| `drug_products.jsonl` | 17 | `drug_product.schema.json` | 17 | 0 | 0 |
| `product_ingredients.jsonl` | 32 | `product_ingredient.schema.json` | 32 | 0 | 0 |
| `clinical_claims.jsonl` | 193 | `clinical_claim.schema.json` | 193 | 0 | 0 |
| `otc_protocols.jsonl` | 26 | `otc_protocol.schema.json` | 26 | 0 | 0 |
| `protocol_options.jsonl` | 47 | `protocol_option.schema.json` | 47 | 0 | 0 |
| `protocol_rules.jsonl` | 177 | `protocol_rule.schema.json` | 177 | 0 | 0 |
| `market_popularity_candidates.csv` | 9 | `exact CSV header contract` | 9 | 0 | 0 |

## 교차 파일 무결성

- 중복 ID: **0**
- 끊어진 참조/역참조/상태 불변식 오류: **0**
- 공식 source locator 누락: **0**
- 권리 필드 중 하나 이상이 `unknown`인 source snapshot: **39 / 39**
- 미검토 candidate(claim/protocol/option/rule): **443**
- 스키마 실패 행 합계: **0**

## 레코드 구성

- 공식 source snapshots: **39**
- ingredients: **31**
- OTC drug products: **17**
- product–ingredient links: **32**
- clinical claims: **193** (`candidate`: 193)
- OTC protocols: **26**
- protocol options: **47**
- protocol rules: **177**
- market proxy rows: **9**

## 안전·근거 상태

- 자동 생성된 임상 claim, protocol, option, rule은 전부 `candidate`이고 `pharmacist_approved=false`다.
- red flag 규칙은 선택 규칙보다 우선순위가 높고, red flag 참이면 제품 후보를 0개로 처리하도록 명시했다.
- 제품 후보는 공식 item_seq 레지스트리와 연결했지만 tenant formulary/inventory 확인 전 최종 추천 제품으로 취급하지 않는다.
- `market_popularity_candidates.csv`의 생산·수입실적은 공개 수치의 후보 프록시이며 소매 판매순위가 아니다.
- 포타겔은 2026-07-06 반영 현행 상세 허가사항(성인 대상, 소아·임신·수유 제외)을 우선했다. 과거 소비자 요약과 충돌 가능성을 source uncertainty에 기록했다.

## 오류 상세

스키마·참조·locator 검사에서 실패가 발견되지 않았다.
