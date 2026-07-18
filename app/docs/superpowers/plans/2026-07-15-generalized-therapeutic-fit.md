# Generalized Therapeutic Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace symptom-specific option overrides and same-ingredient product expansion with an auditable, data-driven therapeutic-fit and product-evidence gate.

**Architecture:** Every preview protocol option receives a structured role and evidence scope from one complete overlay. The recommendation engine ranks those generic fields before legacy numeric priorities and accepts a product only when an active indication claim explicitly names that product. The preview formulary uses the same indication links, so catalog membership and clinical evidence stay separate.

**Tech Stack:** TypeScript, JSON Schema, Node.js ESM, Vitest, React web worker runtime.

---

### Task 1: Add structured therapeutic-fit data

**Files:**

- Create: `data/actual-research-overlays/therapeutic-fit.json`
- Delete: `data/actual-research-overlays/protocol-option-policy.json`
- Modify: `scripts/build-actual-preview-pack.mjs`
- Modify: `apps/web/src/actual-pack.test.ts`

- [ ] **Step 1: Write failing pack tests**

Add assertions that all 47 source options survive the preview build, every option has `therapeutic_role`, and options from sore throat, muscle pain, nasal congestion, and insect bite are ordered by that field rather than by source-row priority.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm exec vitest run --config vitest.config.ts apps/web/src/actual-pack.test.ts`

Expected: FAIL because `therapeutic_role` is absent and the two-protocol policy still removes options.

- [ ] **Step 3: Add the complete overlay and builder validation**

Create one entry for every source option with `role`, `evidence_scope`, and a concrete rationale. Make the builder reject missing, duplicate, or unknown option IDs and reject missing preview safety gates. Merge the structured fields into every preview option without protocol-specific code branches.

- [ ] **Step 4: Rebuild and rerun the focused test**

Run: `node scripts/build-actual-preview-pack.mjs`

Run: `pnpm exec vitest run --config vitest.config.ts apps/web/src/actual-pack.test.ts`

Expected: PASS with 47 classified preview options and no protocol allow-list.

### Task 2: Require direct product-level indication evidence

**Files:**

- Modify: `packages/recommendation/src/index.test.ts`
- Modify: `packages/recommendation/src/index.ts`
- Modify: `apps/web/src/preview-formulary.ts`
- Modify: `apps/web/src/actual-pack.test.ts`

- [ ] **Step 1: Write a failing recommendation regression test**

Clone a formulary product with the same single active ingredient but omit its product ID from the option's indication claim. Assert that the cloned product is excluded while the explicitly named product remains.

- [ ] **Step 2: Run the recommendation test and confirm failure**

Run: `pnpm --filter @pharmassist/recommendation test`

Expected: FAIL because `exactSingleIngredientEquivalent` currently admits the clone.

- [ ] **Step 3: Remove ingredient-equivalence eligibility**

Make `rankedProducts` require `explicitlySupportedProductIds(verified).has(product.product_id)`. Preserve registry, formulary, safety, inventory, and product-ingredient checks.

- [ ] **Step 4: Build the preview formulary from indication claims**

Index each option's active indication-claim `candidate_product_ids`. Create a formulary entry only when the product ID, ingredient link, option, and protocol all agree. Deduplicate by product, ingredient, and symptom category.

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @pharmassist/recommendation test`

Run: `pnpm exec vitest run --config vitest.config.ts apps/web/src/actual-pack.test.ts`

Expected: PASS; no same-ingredient-only product enters a symptom result.

### Task 3: Rank current options by therapeutic role

**Files:**

- Modify: `packages/contracts/schemas/protocol_option.schema.json`
- Modify: `spec/schemas/protocol_option.schema.json`
- Modify: `packages/test-fixtures/src/index.ts`
- Modify: `packages/recommendation/src/index.test.ts`
- Modify: `packages/recommendation/src/index.ts`
- Regenerate: `packages/contracts/src/generated/*`
- Regenerate: `packages/contracts/openapi/*`

- [ ] **Step 1: Add failing role-order tests**

Create preferred and alternative options whose legacy `clinical_priority` values are reversed. Assert preferred appears first. Add a conditional option and assert it appears only after a matching option-selection rule explicitly chooses it.

- [ ] **Step 2: Run the recommendation test and confirm failure**

Run: `pnpm --filter @pharmassist/recommendation test`

Expected: FAIL because sorting currently uses `clinical_priority` first and has no conditional-role gate.

- [ ] **Step 3: Extend the contract**

Add optional `therapeutic_role` (`preferred`, `alternative`, `conditional`), `evidence_scope` (`direct`, `supportive`, `phenotype_specific`), and `fit_rationale` fields. Regenerate contract types and OpenAPI with `pnpm schema:generate`.

- [ ] **Step 4: Implement generic selection and ranking**

When structured fit exists, suppress unselected conditional options. Sort preferred before alternative before selected conditional, then use safety priority, clinical priority, and stable option ID. Apply the same comparator to ingredient and product ordering.

- [ ] **Step 5: Run focused contract and recommendation tests**

Run: `pnpm schema:check`

Run: `pnpm --filter @pharmassist/recommendation test`

Expected: PASS.

### Task 4: Verify representative protocols and the full repository

**Files:**

- Modify: `apps/web/src/actual-pack.test.ts`
- Modify: `docs/DATA_SOURCE_ACTIVATION.md`

- [ ] **Step 1: Add representative cross-protocol assertions**

Assert that sore throat leads with flurbiprofen, muscle and joint pain lead with ibuprofen while retaining grounded alternatives, generic nasal congestion leads with pseudoephedrine instead of an allergy-only option, and insect bite leads with topical hydrocortisone. Assert every displayed product is explicitly named by an active indication claim for the displayed option.

- [ ] **Step 2: Document the separated gates**

Document catalog membership, product-level indication evidence, therapeutic role, safety exclusion, and optional POS tie-break as separate decisions. State that the role overlay remains a research-preview candidate and does not represent pharmacist approval.

- [ ] **Step 3: Run fresh verification**

Run: `node scripts/build-actual-preview-pack.mjs`

Run: `pnpm check`

Stop only repository-owned port 4173 processes, then run: `pnpm test:e2e`

Run: `pnpm test:security`

Expected: all commands exit 0, the 14173 app remains running, and no production publication step runs.
