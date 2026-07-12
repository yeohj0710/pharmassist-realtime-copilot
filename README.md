# PharmAssist Realtime Copilot

## Windows 다운로드

**[PharmAssist 최신 버전 다운로드](https://github.com/yeohj0710/pharmassist-realtime-copilot/releases/latest/download/PharmAssist-Windows.zip)**

1. ZIP 파일을 내려받아 압축을 풉니다.
2. `PharmAssist.exe`를 더블클릭합니다.
3. 첫 실행은 필요한 구성요소 설치 때문에 시간이 조금 걸릴 수 있습니다.

OpenAI API 키 없이도 합성 데이터 기반 로컬 데모가 실행됩니다. AI 보정을 사용하려면 `app\scripts\set-openai-key.ps1`을 실행해 본인의 키를 로컬에만 저장하세요. 키는 GitHub 배포 파일에 포함되지 않습니다.

약사 상담 중 “지금 말할 내용, 다음 질문, 위험 신호, 피할 것”을 빠르게 보여주는 로컬 우선 PWA다. 현재 포함된 지식은 전부 합성 fixture다. **임상 사용 금지.** 공식 데이터·면허자 승인·법률 검토가 끝나기 전에는 실제 환자 상담에 쓰면 안 된다.

## 바로 실행

Windows에서는 저장소 루트의 `PharmAssist.exe`를 더블클릭한다. 첫 실행만 의존성을 자동 설치하고, 서버는 백그라운드에서 조용히 실행되며 준비되면 브라우저만 열린다. 다시 실행하면 기존 서버를 재사용해 브라우저만 연다. 문제 진단 로그는 `app\logs\pharmassist.log`에 저장된다. 기본 설정은 OpenAI 호출이 꺼진 로컬 데모라 API 비용이 발생하지 않는다.

API 키를 안전하게 로컬에 저장하려면 다음 명령을 실행한다. 입력 문자는 화면에 표시되지 않으며 `.env`는 Git에서 제외된다.

```powershell
powershell -ExecutionPolicy Bypass -File "app/scripts/set-openai-key.ps1"
```

명령줄 실행은 아래와 같다.

요구 환경: Node 24.12.x, Corepack, pnpm 11.11.x.

```powershell
Set-Location "app"
Copy-Item .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm dev:demo
```

### OpenAI 비용

기본 `.env`는 OpenAI 기능이 모두 꺼져 있어 비용이 발생하지 않는다. 활성화 시에도 저비용 `gpt-5.4-mini`, reasoning 없음, 최대 출력 420토큰, 2.5초 timeout, refinement 60회/시간, 음성 20 session/시간을 강제한다. 계정 전체 월 지출 제한과 알림은 OpenAI 프로젝트 설정에서 별도로 지정해야 한다.

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
