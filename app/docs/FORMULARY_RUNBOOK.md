# Tenant formulary and POS runbook

## 입력 경계

POS CSV 최소 열:

```csv
tenant_sku,sold_at,units,item_seq,product_id,symptom_category
```

`patient`, `환자`, `name`, `성명`, `phone`, `전화`, `address`, `주소` 계열 열은 import 단계에서 거부한다. 원본 CSV는 처리 후 결과 artifact에 포함하지 않는다.

## 후보 생성

1. 활성 pack의 OTC product registry에서 공급실적 제품만 시작 집합으로 사용한다.
2. withdrawn, discontinued, blocked, inactive, DUR blocking 제품을 제거한다.
3. tenant SKU를 공식 `item_seq` 또는 사전 승인된 `product_id`로 crosswalk한다.
4. 최근 90일 판매만 `TenantSalesAggregate`로 집계한다.
5. 전체 누적 판매 coverage 0.85–0.90까지 후보를 선택한다.
6. 증상 카테고리별 최소 1개 후보를 보정한다.
7. 약사가 ingredient–product–symptom 연결과 대체 가능성을 검토한다.
8. `TenantFormulary.status=active`, pharmacist approval, 활성 `pack_id`가 모두 일치할 때만 runtime에 제공한다.

## Import 순서

1. active pack 확인: `GET /v1/knowledge/manifest`
2. formulary import: `POST /v1/admin/formulary/import`
3. inventory import: `POST /v1/admin/inventory/import`
4. sales aggregate import: `POST /v1/admin/sales/import`

각 inventory/sales row는 `tenant_id`, 활성 `pack_id`, 활성 pack의 `product_id`, operational `source_snapshot_id`를 가진다. POS snapshot은 임상 pack source 목록에 포함할 필요가 없고, 임상 추천 근거로 출력하지 않는다.

## Runtime 불변식

- inventory가 연결된 tenant의 `recommend`에는 in-stock product candidate가 최소 하나 있어야 한다.
- 수량 0, out-of-stock, inactive, discontinued product는 제거한다.
- formulary에 없거나 약사 미승인 product는 제거한다.
- 임상 적합성과 안전 점수가 먼저 확정되고, 재고 수량과 90일 sales rank는 그 뒤 tie-break로만 적용된다.
- tenant A의 formulary/inventory/sales/state를 tenant B에 전달하지 않는다.
- pack 전환 시 호환되지 않는 formulary와 상담 상태를 제거한다.
