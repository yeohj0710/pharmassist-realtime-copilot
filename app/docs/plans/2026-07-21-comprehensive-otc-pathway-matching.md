# Comprehensive OTC Pathway Matching Implementation Plan

> **For agentic workers:** Execute this plan inline. Do not commit, push, deploy, or modify process 14173 without explicit user approval.

**Goal:** Classify every officially confirmed retail medicine into an auditable symptom pathway, rank products by product-specific fit, and support safe multi-mechanism product combinations in the local research preview.

**Architecture:** A versioned clinical-pathway dataset defines symptom concepts, product-fit rules, therapeutic roles, mechanisms, compatible combination roles, and referral conditions. The registry importer applies those rules to every confirmed official product and emits one mapping record per SKU with evidence and exclusion reasons. The pack builder converts eligible mappings into verified research-preview ingredients, options, claims, products, and combination rules; the deterministic recommendation engine evaluates patient safety before ranking a single product or a compatible combination.

**Tech Stack:** TypeScript, JSON Schema, Node.js build scripts, Vitest, Playwright, existing Health.kr registry and actual research-preview pack.

---

### Task 1: Define auditable clinical pathways

**Files:**

- Create: `app/data/clinical-pathways/pathways.json`
- Create: `app/packages/domain/src/clinical-pathways.ts`
- Modify: `app/packages/domain/src/index.ts`
- Test: `app/packages/domain/src/clinical-pathways.test.ts`

- [ ] Define pathway records with `pathway_id`, `protocol_id`, `intent`, `symptom_concepts`, `official_efficacy_terms`, `route_form_terms`, `therapeutic_role`, `mechanism_tags`, `combination_role`, `compatible_roles`, `priority`, `source_refs`, and `research_only`.
- [ ] Cover the PDF categories: cold/rhinitis, cough/sputum, sore throat, pain/headache, heartburn/dyspepsia/gas/cramp, diarrhea, constipation, pediatric fever/cold, fungal and inflammatory skin disease, wounds/burns, oral disease, eye symptoms, patches, hemorrhoids, acne/scars/pigmentation, sleep/anxiety, women’s health, smoking cessation, and animal medicine separation.
- [ ] Replace the hard-coded `productProtocolProfiles` regular expressions with a loader and matcher that returns scored pathway matches plus matched evidence terms.
- [ ] Test inclusion, route mismatch, negation/exclusion, specific-over-broad priority, and deterministic ordering.

### Task 2: Extract compositional symptom concepts

**Files:**

- Create: `app/packages/normalizer/src/symptom-concepts.ts`
- Modify: `app/packages/normalizer/src/index.ts`
- Test: `app/packages/normalizer/src/index.test.ts`

- [ ] Represent aliases as concepts such as `bowel_urgency`, `abdominal_pain`, `heartburn`, `watery_diarrhea`, `dry_cough`, and `productive_cough` rather than full-sentence substitutions.
- [ ] Detect noun and predicate components independently so colloquial endings and spacing variants produce the same concept set.
- [ ] Add derived `symptom_concepts` slot evidence and canonical retrieval tokens without rewriting the customer’s displayed sentence.
- [ ] Remove the one-off `똥...마려...` replacement and test multiple unseen combinations, including bowel urgency with and without pain.

### Task 3: Classify every confirmed registry SKU

**Files:**

- Modify: `app/tools/ingest/src/healthkr-product-registry.ts`
- Modify: `app/tools/ingest/src/healthkr-product-registry.test.ts`
- Modify: `app/packages/contracts/schemas/pharmacy_product_registry.schema.json`
- Regenerate: `app/packages/contracts/src/generated/pharmacy_product_registry.ts`
- Generate: `app/data/healthkr-product-registry/registry.json`
- Generate: `app/data/healthkr-product-registry/report.json`

- [ ] Add `clinicalPathways[]` per record with pathway ID, protocol ID, score, matched official fields, therapeutic role, mechanism tags, and combination role.
- [ ] Select protocols from official efficacy and route/form first; use ingredient identity to rank within a pathway, not as a prerequisite for classification.
- [ ] For combination products, keep the product when at least one active component directly supports the pathway; record remaining components as supportive, duplicate, conflicting, or unmapped.
- [ ] Emit an explicit unmapped reason for every confirmed SKU that has no pathway; require the report totals to equal 458 confirmed SKUs.
- [ ] Generate stable canonical IDs for previously unmapped official active ingredients without merging different substances by loose name similarity.

### Task 4: Build full research-preview candidates

**Files:**

- Modify: `app/scripts/build-actual-preview-pack.mjs`
- Modify: `app/data/actual-research-overlays/therapeutic-fit.json`
- Create: `app/data/actual-research-overlays/combination-rules.json`
- Generate: `app/data/actual-candidate-pack/pack.json`
- Generate: `app/data/actual-candidate-pack/healthkr-legacy-match-report.json`

- [ ] Import every confirmed, active OTC SKU that has a direct pathway and no identity/source conflict into the research-preview pack.
- [ ] Generate official-source-backed ingredient, option, and claim records for canonical ingredients not present in the original 31-ingredient pack.
- [ ] Attach product-specific pathway IDs, mechanism tags, therapeutic role, fit score, age/pregnancy flags, interaction terms, and official source URLs.
- [ ] Generate combination rules only for distinct roles and mechanisms, including the PDF examples: acid suppression plus barrier/neutralization, digestive enzyme plus motility support, analgesic plus local/supportive care, and Western medicine plus herbal supportive care when official indications overlap.
- [ ] Reject duplicate active ingredients, conflicting routes, mutually exclusive phenotypes, and products failing either product’s safety gate.

### Task 5: Return and render single or combination recommendations

**Files:**

- Modify: `app/packages/contracts/schemas/recommendation_decision.schema.json`
- Regenerate: `app/packages/contracts/src/generated/recommendation_decision.ts`
- Modify: `app/packages/recommendation/src/index.ts`
- Modify: `app/packages/runtime/src/index.ts`
- Modify: `app/apps/web/src/App.tsx`
- Modify: `app/apps/web/src/styles.css`
- Test: `app/packages/recommendation/src/index.test.ts`
- Test: `app/apps/web/src/actual-pack.test.ts`

- [ ] Add `combination_candidates` containing products, distinct mechanism/role labels, rationale, and source references.
- [ ] Rank direct product fit before supportive fit, then safety, formulary/inventory, price, and valid tenant 90-day sales rank.
- [ ] Return a predeclared best default immediately for a classified pathway; replace it when later answers select a more specific phenotype.
- [ ] Keep red-flag behavior unchanged: referral produces zero single and combination candidates.
- [ ] Render one recommended set without exposing internal decision IDs and label research-only status clearly.

### Task 6: Verify coverage and behavior

**Files:**

- Create: `app/data/clinical-pathways/coverage-report.json`
- Modify: `app/apps/web/src/actual-pack.test.ts`
- Modify: `app/tests/e2e/consult.spec.ts`
- Modify: `app/docs/DATA_SOURCE_ACTIVATION.md`

- [ ] Assert one auditable result for all 458 confirmed SKUs: mapped direct, mapped supportive-only, or unmapped with reason.
- [ ] Add regression flows for dry/productive cough, allergic/infectious rhinitis, heartburn/dyspepsia/cramp, acute/chronic diarrhea, constipation type, headache type, skin phenotype, pediatric dosing context, and combination recommendations.
- [ ] Verify that generic inputs show the predeclared pathway default and that later answers switch products instead of repeating the same question.
- [ ] Run focused tests, full unit/integration tests, typecheck, build, E2E, security scan, hash/integrity checks, and bundle privacy scans.
