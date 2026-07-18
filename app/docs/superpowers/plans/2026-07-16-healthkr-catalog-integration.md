# Health.kr Product Catalog Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all 776 locally enriched retail SKUs, preserve retail and official identities separately, and allow only safe `confirmed` OTC products into deterministic consultation recommendations.

**Architecture:** A reusable importer reads `C:\dev\pharmacy-product-catalog\data\enrichment-queue.json`, validates all source rows, and writes a normalized registry plus a hash-bound report and manifest. The actual preview pack builder merges only eligible official product links into the existing product registry; the formulary and recommendation engine independently enforce official status, indication, product safety, grouping, and price-only tie-breaking. The web UI receives structured candidate details and never renders internal decision or evidence IDs.

**Tech Stack:** TypeScript, Node.js, JSON Schema 2020-12, Ajv, Vitest, React, Vite, pnpm/Turborepo.

---

### Task 1: Normalize and validate the 776-row source

**Files:**

- Create: `packages/contracts/schemas/pharmacy_product_registry.schema.json`
- Create: `tools/ingest/src/healthkr-product-registry.ts`
- Create: `tools/ingest/src/healthkr-product-registry.test.ts`
- Create: `scripts/import-healthkr-product-registry.ts`
- Modify: `tools/ingest/src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Add tests for exact status counts, stable official keys, invalid pseudo-standard-codes, retail offer preservation, cancelled/conflicted exclusions, and deterministic protocol mapping.**

```ts
expect(report.sourceRecordCount).toBe(776);
expect(report.matchStatusCounts).toEqual({
  confirmed: 369,
  review_required: 82,
  not_found: 137,
  not_applicable: 188,
});
expect(
  registry.records.filter((row) => row.recommendation.eligible),
).toSatisfyAll((row) => row.officialMatch.status === "confirmed");
```

- [ ] **Step 2: Run the focused ingest test and verify that it fails before implementation.**

Run: `pnpm exec vitest run --config vitest.package.config.ts tools/ingest/src/healthkr-product-registry.test.ts`

- [ ] **Step 3: Implement a strict converter that uses `official_item_seq`/`official_product_key` only, retains every source SKU, separates `retailOffer` from `officialProduct`, converts DUR sections to structured flags, and records every exclusion reason.**

```ts
const eligible =
  row.official_match_status === "confirmed" &&
  rawDrugClass(row) === "2" &&
  !isCancelled(row) &&
  conflicts(row).length === 0 &&
  allActiveIngredientsMapped &&
  protocolIds.length > 0;
```

- [ ] **Step 4: Write `registry.json`, `report.json`, then a manifest containing source/output SHA-256 values; clean temporary files in `finally`.**

Run: `pnpm data:import:healthkr-registry --source C:\dev\pharmacy-product-catalog`

Expected: 776 imported rows, exact status distribution, zero dropped source SKU IDs, and matching registry/report/source hashes.

### Task 2: Merge eligible official products into the actual preview pack

**Files:**

- Modify: `packages/contracts/schemas/drug_product.schema.json`
- Modify: `scripts/build-actual-preview-pack.mjs`
- Modify: `apps/web/src/actual-pack.test.ts`
- Generate: `packages/contracts/src/generated/*`
- Generate: `packages/contracts/openapi/*`
- Generate: `data/actual-candidate-pack/pack.json`

- [ ] **Step 1: Add pack tests proving that every imported product has a confirmed match, active OTC status, exact source reference, mapped active ingredients, and protocol IDs.**

```ts
expect(
  importedProducts.every(
    (product) =>
      product.official_match_status === "confirmed" &&
      product.otc_status === "otc" &&
      product.protocol_ids.length > 0,
  ),
).toBe(true);
```

- [ ] **Step 2: Extend `DrugProduct` with normalized retail display data, official status/source, full product-detail fields, protocol IDs, clinical group key, and structured DUR metadata.**

- [ ] **Step 3: Merge by stable imported product ID without fuzzy name matching, add exact ingredient links and a Health.kr source snapshot, and keep existing source provenance.**

- [ ] **Step 4: Generate contracts/OpenAPI and rebuild the actual pack.**

Run: `pnpm schema:generate`

Run: `node scripts/build-actual-preview-pack.mjs`

### Task 3: Enforce product-level safety and formulary gates

**Files:**

- Modify: `apps/web/src/preview-formulary.ts`
- Modify: `packages/recommendation/src/index.ts`
- Modify: `packages/recommendation/src/index.test.ts`
- Modify: `packages/contracts/schemas/recommendation_decision.schema.json`

- [ ] **Step 1: Add failing tests for red-flag zero candidates, age/pregnancy/DUR exclusion, indication filtering, unconfirmed exclusion, clinical grouping, and price-only tie-breaking.**

```ts
expect(decisionFor(pregnantInput).product_candidates).toEqual([]);
expect(unconfirmedDecision.product_candidates).not.toContainEqual(
  expect.objectContaining({ official_match_status: "review_required" }),
);
```

- [ ] **Step 2: Build preview formulary entries from exact imported `protocol_ids` and ingredient links, while keeping research-preview pharmacist approval false.**

- [ ] **Step 3: Add `evaluateProductEligibility()` as defense in depth for official status, permit state, protocol indication, route/form, age, pregnancy, allergy, interactions, and DUR.**

- [ ] **Step 4: Rank only after eligibility, group identical active-ingredient/form/route candidates, and use retail price only after clinical/safety/inventory comparisons.**

- [ ] **Step 5: Add structured candidate display fields to the output contract and regenerate types/OpenAPI.**

### Task 4: Show readable product evidence in the consultation UI

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `tests/e2e/consult.spec.ts`

- [ ] **Step 1: Render product name, snapshot price, specification, official-link badge, main indication, dosage, concise precaution, dosage form/route, and source link.**

- [ ] **Step 2: Remove internal claim/snapshot/locator values from the rendered evidence panel and show source names with external links only.**

- [ ] **Step 3: Preserve the existing center consultation and right-side supporting-candidate layout at desktop and mobile widths.**

- [ ] **Step 4: Add E2E assertions for the readable official product card and absence of internal IDs.**

### Task 5: Verify the whole integration

**Files:**

- Modify: `docs/DATA_SOURCE_ACTIVATION.md`
- Update: generated reports only through existing test commands

- [ ] **Step 1: Run focused importer, recommendation, runtime, web, and E2E tests.**

- [ ] **Step 2: Run `pnpm check` and `pnpm test:security`.**

- [ ] **Step 3: Re-read generated registry/report/manifest and calculate exact imported, confirmed, eligible, review/not-found/not-applicable, and mapping-failure counts.**

- [ ] **Step 4: Inspect the production web bundle for source paths, raw source records, internal IDs, and unconfirmed official presentation.**

- [ ] **Step 5: Perform an independent code review, apply only in-scope fixes, and rerun affected verification.**
