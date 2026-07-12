# Operations runbook

## Local demo

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm pack:build:dev
corepack pnpm pack:verify
corepack pnpm dev:demo
```

`/v1/health/live`는 process 생존, `/v1/health/ready`는 local knowledge 준비를 뜻한다. OpenAI가 꺼져도 local core는 degraded 상태로 계속 준비된다.

## Database

```powershell
$env:DATABASE_URL="postgresql://pharmassist:...@host:5432/pharmassist"
corepack pnpm db:migrate
corepack pnpm db:seed:synthetic # production에서는 차단됨
```

Backup: `pg_dump --format=custom --file pharmassist.dump $env:DATABASE_URL`. Restore는 격리 DB에서 `pg_restore --clean --if-exists --dbname $env:DATABASE_URL pharmassist.dump` 후 migration, row count, tenant, pack hash를 검증한다.

## Production activation

1. `APP_PROFILE=production`; synthetic flags 0건 확인.
2. 실제 OIDC issuer/audience/JWKS와 role/tenant claim binding 적용.
3. official signed pack, public verify key, external KMS signing flow 연결.
4. secret store에서 DB/OpenAI secret 주입. client bundle scan.
5. migration backup/restore drill, rollback/revocation drill 수행.
6. 모든 AUTO, BENCH, MANUAL, EXTERNAL release gate 서명 후 배포.

배포 후 5xx/rate-limit/refinement rejection/realtime failure/pack version을 content-free metric으로 감시한다. 환자 입력을 log나 trace에 추가하지 않는다.
