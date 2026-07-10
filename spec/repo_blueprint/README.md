# Repository Blueprint

이 폴더는 Codex가 실제 저장소를 만들 때 사용할 **설정 골격**이다. 파일명에 `.example`이 붙은 것은 그대로 복사하라는 의미가 아니라, 환경과 최신 dependency/API에 맞춰 구현하고 lock/test하라는 계약이다.

## 핵심 프로필

- `local-demo`: 합성 knowledge pack + OpenAI mock. API key 불필요.
- `local-live`: 합성 pack + 실제 Responses/Realtime 연결. 임상 사용 금지.
- `staging`: 인증, signed pack, telemetry, reviewer workflow 활성.
- `production`: official/approved pack만. synthetic/placeholder 발견 시 fail closed.

## 실행 인터페이스

루트 scripts는 최소한 다음을 제공한다.

```text
pnpm dev
pnpm dev:demo
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
pnpm benchmark
pnpm pack:lint
pnpm pack:build:dev
pnpm pack:verify
pnpm db:migrate
pnpm db:seed:synthetic
```

## 중요한 구현 경계

- OpenAI SDK와 Realtime API shape는 `packages/openai-adapter` 뒤에 숨긴다.
- Web 앱은 표준 API key와 signing private key를 절대 번들하지 않는다.
- 관측 시스템은 arbitrary object/logger를 받지 않고 allowlisted event type만 받는다.
- production process는 signed, non-synthetic, current pack 없이는 시작하지 않는다.
- 이 blueprint 자체에는 실제 환자/약물/원본 자료가 없다.
