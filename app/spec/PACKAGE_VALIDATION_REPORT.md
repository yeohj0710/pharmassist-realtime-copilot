# Package Validation Report

**Validation date:** 2026-07-10  
**Result:** PASS

## Source review completeness

- Source files audited: 124
- PDF: 52 files / 1730 pages
- Images: 70 files
- XLSX/DOCX: 1/1
- Extracted PDF text: 1,123,893 characters
- `reviewed_for_design=true`: 124/124
- Raw source files copied into handoff bundle: 0

## Artifact checks

- Package files: 86
- JSON files parsed: 15
- YAML files parsed: 11
- JSON Schemas meta-validated: 6
- Consultation card examples validated against schema: 3
- Runtime input/output examples validated against schema: 2
- Golden behavior cases parsed: 50
- Adversarial behavior cases parsed: 50
- Source audit/manifest rows: 124/124
- Candidate intent/alias/slot rows: 73/219/31
- Prompt registry entries and SHA-256 checks: 7
- Broken internal Markdown links: 0
- Raw PDF/image/DOCX/XLSX files in bundle: 0
- Obvious secret/private-key patterns: 0

## Safety properties represented in the package

- local-first first-card path and explicit latency budgets
- triage before recommendation
- blocking-slot and numeric-output gates
- product/domain/source/expiry/revocation gates
- model claim/source allowlist and safety monotonicity
- prompt-injection and stale-sequence tests
- no raw audio/transcript logging defaults
- synthetic/placeholder production fail-closed gate

## Important limitation

This PASS means the **handoff specification package is structurally complete and internally validated**. It does not mean a deployed application or clinical knowledge pack has already passed pharmacist, legal, privacy, regulatory, official-data, or target-device validation. Those are explicit implementation/release gates in `codex/ACCEPTANCE_CRITERIA.md`.
