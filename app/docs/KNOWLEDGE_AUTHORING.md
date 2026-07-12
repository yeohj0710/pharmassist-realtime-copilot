# Knowledge authoring and publishing

출처를 바로 카드로 만들지 않는다. Source → Claim → Card → Review → immutable Pack 순서를 지킨다.

## 필수 gate

- 임상 published claim은 A/B source만 허용
- locator, jurisdiction, product/formulation/population, verified/expiry 필수
- unresolved conflict, expired/revoked/unapproved, domain leak 차단
- pharmacist와 medical-safety 승인 모두 필요
- reviewer와 publisher 역할 분리
- private signing key는 repo/client/CI artifact에 두지 않음

## Dev pack

```powershell
corepack pnpm pack:lint
corepack pnpm pack:build:dev
corepack pnpm pack:verify
```

dev 명령은 임시 Ed25519 private key를 메모리에서 만들고 즉시 폐기한다. 결과는 synthetic·clinical-use-prohibited다.

Production은 승인된 source adapter와 license register를 먼저 연결한다. 외부 KMS/HSM의 private key로 canonical manifest를 서명하고, public key만 runtime에 배포한다. smoke test 후 atomic activate하며 정상 pack 3개를 보존한다.
