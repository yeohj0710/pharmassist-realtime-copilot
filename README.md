# PharmAssist Realtime Copilot

약사 상담 중 “지금 말할 내용, 다음 질문, 위험 신호, 피할 것”을 빠르게 보여주는 로컬 우선 PWA다. 현재 포함된 지식은 전부 합성 fixture다. **임상 사용 금지.** 공식 데이터·면허자 승인·법률 검토가 끝나기 전에는 실제 환자 상담에 쓰면 안 된다.

## 바로 실행

요구 환경: Node 24.12.x, Corepack, pnpm 11.11.x.

```powershell
Copy-Item .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm dev:demo
```

- 상담 PWA: `http://127.0.0.1:4173`
- Reviewer: `http://127.0.0.1:4174`
- API: `http://127.0.0.1:8080/v1/health/ready`

OpenAI key 없이 normalize → safety → retrieve → render 전체 로컬 경로가 동작한다. 음성·Responses 기능은 기본적으로 꺼져 있고 직접 입력으로 안전하게 돌아간다.

## 검증

```powershell
corepack pnpm check
corepack pnpm test:e2e
corepack pnpm pack:build:dev
corepack pnpm pack:verify
corepack pnpm benchmark
corepack pnpm run sbom:generate
```

Docker가 있으면:

```powershell
docker compose build
docker compose up -d
docker compose exec api node database/migrate.mjs
```

컨테이너는 non-root, read-only filesystem, dropped capabilities로 실행한다. 이 작업 환경에는 Docker가 없어 Compose 실행은 미검증 외부 gate로 기록한다.

## 저장소 구조

- `apps/web`: offline PWA, Web Worker, PTT/WebRTC adapter
- `apps/api`: Fastify `/v1` API, RBAC, rate limit, no-store, SDP broker
- `apps/reviewer`: source → claim → card → review → pack 검토 흐름
- `packages/*`: contracts, domain, normalizer, safety, retrieval, knowledge, OpenAI, observability
- `tools/*`: 공식-source adapter 경계, pack CLI, benchmark
- `database`: 개인정보 원문을 저장하지 않는 migration/seed
- `spec`: 원본 handoff 사양의 읽기 전용 사본

## 운영 경계

`APP_PROFILE=production`은 synthetic pack을 거부한다. production 활성화에는 공식 출처 사용권, A/B tier locator, 만료 검증, 약사+medical-safety 승인, reviewer/publisher 분리, 외부 private signing key가 모두 필요하다. 자세한 내용은 `docs/INTENDED_USE_AND_LIMITATIONS.md`와 `docs/LEGAL_REVIEW_CHECKLIST.md`에 있다.

## GitHub

`.github/workflows/ci.yml`과 `security.yml`이 준비돼 있다. 저장소를 만들고 push하기 전 CODEOWNERS의 `@repository-owner`를 실제 계정/팀으로 바꾼다. 공개 저장소 생성과 push는 외부 게시 작업이므로 별도 승인 후 수행한다.
