# Implementation report

## Build identity

- Date: 2026-07-10 Asia/Seoul
- Node/pnpm: Node 24.12.0 / pnpm 11.11.0
- App/schema: 0.1.0 / 1.0.0
- Knowledge: 0.1.0-synthetic-dev, clinical use prohibited
- Git: local `main`; remote publication not performed

## Implemented

PWA local Worker, Fastify API, reviewer console, strict schemas/OpenAPI, deterministic Korean runtime, ordered safety gates, signed immutable development pack, mock and official Responses adapters, WebRTC transcription broker, content-free observability, PostgreSQL migrations, Docker/Compose, CI/security workflows, benchmark, and activation runbooks.

Production profile fails closed unless a signed, non-synthetic pack with acceptable provenance is supplied. The browser runtime does not yet load a remotely published signed pack and therefore blocks production profile startup. This repository is not clinically production-ready.

## Commands executed

| Command                                         | Exit | Result                                                          |
| ----------------------------------------------- | ---: | --------------------------------------------------------------- |
| `corepack pnpm install`                         |    0 | 17 workspace projects, lockfile enforced                        |
| `corepack pnpm check`                           |    0 | lint, format, schema, OpenAPI, typecheck, 46 tests, build, docs |
| `corepack pnpm test:security`                   |    0 | 2 privacy tests and credential scan                             |
| `corepack pnpm test:e2e`                        |    0 | 3 Chromium keyboard, offline, axe, and critical-lock flows      |
| `corepack pnpm pack:lint`                       |    0 | 6 records; production synthetic gate enforced                   |
| `corepack pnpm pack:build:dev`                  |    0 | development Ed25519 pack built; private key discarded           |
| `corepack pnpm pack:verify`                     |    0 | signature and content hash verified                             |
| `corepack pnpm benchmark`                       |    0 | 4,500 total in-process samples; all targets passed              |
| `corepack pnpm run sbom:generate`               |    0 | CycloneDX 1.6 JSON generated                                    |
| `corepack pnpm audit --prod --audit-level high` |    0 | no known vulnerabilities                                        |

Source handoff integrity was rechecked: 86 files, 0 missing, 0 hash mismatches, 0 extras.

Docker and GitHub CLI executables are unavailable on this machine, so local Docker execution and CLI publication were not possible. GitHub Actions contains Docker Compose configuration and build gates. The connected GitHub account was verified separately, but no external repository was created or pushed without explicit publication approval.

## Benchmark

| Path                |      P50 |      P95 |      P99 | Target | Result |
| ------------------- | -------: | -------: | -------: | -----: | ------ |
| typed exact         | 0.013 ms | 0.022 ms | 0.047 ms | 250 ms | pass   |
| local fuzzy         | 0.016 ms | 0.029 ms | 0.059 ms | 400 ms | pass   |
| stable voice prefix | 0.019 ms | 0.033 ms | 0.073 ms | 700 ms | pass   |

These are synthetic in-process measurements, not target-device, ASR, UI, network, or clinical certification results.

## Remaining external and manual gates

- Licensed official clinical sources and publication metadata
- Pharmacist, medical-safety, legal, privacy, security, and regulatory approval
- Production OIDC/KMS configuration and key custody
- Client-side verified remote-pack distribution and atomic activation
- OpenAI organization data-control approval and live opt-in validation
- Target-device audio, browser, accessibility, load, recovery, and network benchmarks
- Operational drills for incident response, rollback, and revocation

Until every gate is completed, real-patient and clinical production use is prohibited.
