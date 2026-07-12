# Recommended Repository Tree

```text
pharmassist-realtime-copilot/
├── .github/
│   ├── workflows/ci.yml
│   ├── workflows/security.yml
│   └── CODEOWNERS
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/consult/
│   │   │   ├── features/realtime/
│   │   │   ├── features/knowledge/
│   │   │   ├── workers/clinical-engine.worker.ts
│   │   │   ├── service-worker.ts
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── e2e/
│   │   └── vite.config.ts
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/consult.ts
│   │   │   ├── routes/realtime.ts
│   │   │   ├── routes/knowledge.ts
│   │   │   ├── routes/feedback.ts
│   │   │   ├── routes/admin.ts
│   │   │   ├── plugins/auth.ts
│   │   │   ├── plugins/privacy-logging.ts
│   │   │   ├── services/
│   │   │   └── server.ts
│   │   └── test/
│   └── reviewer/
│       ├── src/
│       │   ├── features/sources/
│       │   ├── features/claims/
│       │   ├── features/cards/
│       │   ├── features/conflicts/
│       │   ├── features/reviews/
│       │   └── features/packs/
│       └── e2e/
├── packages/
│   ├── contracts/
│   │   ├── schemas/
│   │   ├── src/generated/
│   │   ├── src/validators/
│   │   └── openapi/
│   ├── domain/
│   │   ├── src/entities/
│   │   ├── src/value-objects/
│   │   ├── src/invariants/
│   │   └── src/errors/
│   ├── normalizer/
│   │   ├── src/korean.ts
│   │   ├── src/units.ts
│   │   ├── src/pii.ts
│   │   ├── src/negation.ts
│   │   └── src/temporality.ts
│   ├── safety/
│   │   ├── src/red-flags.ts
│   │   ├── src/slot-gate.ts
│   │   ├── src/numeric-gate.ts
│   │   ├── src/product-gate.ts
│   │   └── src/domain-gate.ts
│   ├── retrieval/
│   │   ├── src/exact-index.ts
│   │   ├── src/pattern-index.ts
│   │   ├── src/rules.ts
│   │   ├── src/bm25.ts
│   │   ├── src/trigram.ts
│   │   ├── src/scoring.ts
│   │   └── src/hysteresis.ts
│   ├── knowledge/
│   │   ├── src/policy-lint.ts
│   │   ├── src/compiler.ts
│   │   ├── src/canonical-json.ts
│   │   ├── src/signature.ts
│   │   ├── src/pack-store.ts
│   │   └── src/update-manager.ts
│   ├── openai-adapter/
│   │   ├── src/responses-client.ts
│   │   ├── src/realtime-broker.ts
│   │   ├── src/request-builder.ts
│   │   ├── src/output-validator.ts
│   │   ├── src/prompt-registry.ts
│   │   └── src/mock-provider.ts
│   ├── observability/
│   │   ├── src/audit-events.ts
│   │   ├── src/safe-logger.ts
│   │   ├── src/metrics.ts
│   │   └── src/tracing.ts
│   ├── ui/
│   └── test-fixtures/
├── tools/
│   ├── ingest/
│   │   ├── src/inventory.ts
│   │   ├── src/extract-adapters/
│   │   ├── src/candidate-runner.ts
│   │   └── src/official-source-adapters/
│   ├── pack-cli/
│   │   ├── src/lint.ts
│   │   ├── src/build.ts
│   │   ├── src/sign.ts
│   │   ├── src/verify.ts
│   │   └── src/rollback.ts
│   └── benchmark/
│       ├── src/local-engine.ts
│       ├── src/voice-replay.ts
│       └── src/report.ts
├── data/
│   ├── synthetic/                 # DEMO ONLY
│   ├── generated-dev-pack/        # signed with dev-only key
│   └── README.md
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql-or-orm/
├── infra/
│   ├── docker/
│   ├── compose/
│   ├── observability/
│   └── deployment-reference/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── TRACEABILITY_MATRIX.md
│   ├── THREAT_MODEL.md
│   ├── PRIVACY_AND_DATA_FLOW.md
│   ├── OPENAI_INTEGRATION.md
│   ├── KNOWLEDGE_AUTHORING.md
│   ├── INCIDENT_AND_ROLLBACK.md
│   ├── BENCHMARKS.md
│   ├── INTENDED_USE_AND_LIMITATIONS.md
│   └── LEGAL_REVIEW_CHECKLIST.md
├── tests/
│   ├── golden/
│   ├── adversarial/
│   ├── security/
│   ├── integration/
│   └── performance/
├── spec/                          # this handoff package, read-only
├── .env.example
├── .gitignore
├── compose.yaml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── IMPLEMENTATION_REPORT.md
└── README.md
```

## Dependency boundaries

```text
contracts ← domain
contracts/domain ← normalizer, safety, retrieval, knowledge
contracts/domain/knowledge ← openai-adapter
all core packages ← apps/tools
observability may receive only content-free typed events
```

- `safety` must not depend on OpenAI.
- `retrieval` must not depend on network or DB.
- `web` may not import server secret/config packages.
- `reviewer` may not directly sign/publish without API authorization.
- `openai-adapter` may not write claims/cards or bypass knowledge policy.
- `observability` serializer accepts allowlisted fields, not arbitrary objects.
