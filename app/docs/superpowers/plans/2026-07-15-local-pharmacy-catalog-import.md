# Local Pharmacy Catalog Candidate Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use systematic-debugging for defects and verification-before-completion before reporting success. Do not commit, push, deploy, or publish this local private catalog.

**Goal:** Read 776 private pharmacy SKUs from an external local repository, create a minimal candidate-only derivative with provenance, and measure overlap with the current 27-product research formulary without exposing price or enabling clinical recommendations.

**Architecture:** Keep the source repository read-only. Put reusable normalization, grouping, classification routing, and runtime-name crosswalk logic in `@pharmassist/ingest`; keep the CLI responsible for file validation and atomic writes. Store generated candidates only under the root `etc/` directory, outside the web bundle and Git-tracked app data. Treat retail-name intersections as review hints, never as official MFDS matches.

**Tech Stack:** TypeScript 7, Node.js 24, Vitest, pnpm, JSONL

---

## Task 1: Lock the private-data boundary with tests

**Files:**

- Create: `tools/ingest/src/local-pharmacy-catalog.test.ts`
- Create: `tools/ingest/src/local-pharmacy-catalog.ts`

1. Add fixtures covering duplicate SKU IDs, normalized name/capacity grouping, cosmetic and medical-device categories, ambiguous medicine/supplement categories, and an existing runtime product name.
2. Assert that grouped output preserves source SKU IDs and minimal provenance but excludes `price`, `displayed_price_krw`, images, and full source records.
3. Assert that no candidate is formulary-eligible, officially matched, or clinically usable.
4. Run the focused test and confirm it fails before implementation.

## Task 2: Implement deterministic candidate derivation

**Files:**

- Create: `tools/ingest/src/local-pharmacy-catalog.ts`
- Modify: `tools/ingest/src/index.ts`

1. Normalize retail name and capacity with Unicode-aware punctuation and whitespace removal.
2. Group by normalized name plus normalized capacity while preserving every source SKU ID.
3. Route explicit `코스메틱` and `의료기기` categories to their regulatory domains. Route known supplement merchandising categories to medicine-or-supplement review and all remaining non-explicit categories to medicine-or-other review; do not invent a definitive official class.
4. Match existing runtime products using an exact normalized retail name. Produce a separate near-name review hint when only common dosage-form suffixes differ.
5. Emit candidate-only records with null official identifiers, required official checks, `clinicalUseProhibited=true`, and `formularyEligible=false`.
6. Run the focused tests until they pass.

## Task 3: Add the local import CLI and report

**Files:**

- Create: `scripts/import-local-pharmacy-catalog.ts`
- Modify: `package.json`
- Modify: `.env.example`

1. Accept the source directory through `--source` or `PHARMACY_CATALOG_SOURCE_DIR`; never hardcode the user's private path in committed code.
2. Validate the source JSON shape and compute the source SHA-256 without copying raw rows.
3. Read the current 27 products from the research pack only for name-intersection hints.
4. Print a dry-run report without writing by default.
5. With `--write`, write only `candidates.jsonl`, `dry-run-report.json`, and `manifest.json` to the fixed root `etc/pharmacy-product-catalog-candidate/` directory. Hash the catalog and report, then replace the manifest last as the generation marker.
6. Reject alternate output paths and reject canonical paths that escape through a symlink or Windows junction.

## Task 4: Document the promotion gate

**Files:**

- Modify: `docs/DATA_SOURCE_ACTIVATION.md`

1. Document the local command and private output location.
2. State that retail price, stock, POS sales, and rank are not imported.
3. State that retail-name overlap is not an official match.
4. Require MFDS item identity, permit/ingredient/DUR joins, protocol indication evidence, and pharmacist review before runtime formulary promotion.

## Task 5: Generate and verify the 776-SKU candidate layer

**Files:**

- Generate locally: `..\etc\pharmacy-product-catalog-candidate\candidates.jsonl`
- Generate locally: `..\etc\pharmacy-product-catalog-candidate\manifest.json`
- Generate locally: `..\etc\pharmacy-product-catalog-candidate\dry-run-report.json`

1. Run the CLI in dry-run mode against `C:\dev\pharmacy-product-catalog` and verify 776 source SKUs.
2. Run with `--write` and verify atomic local outputs contain no price-like fields.
3. Confirm the source `data/products.json` hash is unchanged and the importer made no source writes.
4. Run focused tests, `pnpm check`, and `pnpm test:security`.
5. Confirm generated private candidates are absent from `git status`, app `data/`, and the browser bundle.
