# Knowledge authoring and publishing

출처 응답을 곧바로 환자용 추천으로 만들지 않는다. 공식 source와 tenant 운영 데이터를 분리하고 다음 lifecycle을 지킨다.

```text
SourceSnapshot
  -> normalized Ingredient / DrugProduct / ProductIngredient
  -> candidate ClinicalClaim
  -> candidate OTCProtocol / ProtocolOption / ProtocolRule
  -> pharmacist review + official-source verification
  -> compile/lint
  -> immutable pack
  -> external KMS/HSM signing
  -> smoke test
  -> atomic tenant activation
```

## Candidate와 published의 경계

- 자동 parser·LLM extraction 결과는 항상 `candidate`다.
- 구체 성분 선택, 금기, 연령, 임신, 상호작용, 사용법 규칙은 공식 locator와 약사 승인이 없으면 `published`가 될 수 없다.
- product registry 존재만으로 protocol eligibility를 만들지 않는다.
- source text의 불확실성, operation-path drift, 필드 alias를 source snapshot에 기록한다.
- 검토자는 claim/protocol/rule의 source ref가 실제 source snapshot과 locator에 연결되는지 확인한다.

## Publication gate

- domain은 `human_otc`여야 한다.
- pack·protocol·review·source가 만료되지 않아야 한다.
- ingredient/product/link/claim/protocol/option/rule의 ID와 source ref가 pack 내부에서 닫혀 있어야 한다.
- published claim/protocol/option/rule과 active ingredient는 pharmacist approval 및 official-source verification이 필요하다.
- product는 OTC, active, 공급실적 대상이며 withdrawn/discontinued/blocked가 아니어야 한다.
- unresolved conflict, revoked entity, placeholder locator, domain leak를 차단한다.
- production source는 공식 source이며 commercial use, cache, redistribution, AI-context use가 모두 명시적으로 허용되어야 한다.
- 약학정보원/Health.kr은 서면 계약의 사용범위가 확인되기 전에는 optional provider이고, 공개 웹페이지를 대량 크롤링하지 않는다.
- reviewer와 publisher 역할을 분리한다.

## Tenant formulary

전국 임의 top-N을 만들지 않는다.

1. MFDS 공급실적이 있는 OTC 모집단을 만든다.
2. 허가취하·단종·DUR 차단 제품을 제거한다.
3. 최근 90일 tenant POS를 공식 `item_seq`/`product_id`로 crosswalk한다.
4. 누적 판매 85–90% coverage 후보를 계산한다.
5. 증상 카테고리별 최소 coverage를 보정한다.
6. 약사가 product–ingredient–symptom 연결을 승인한다.
7. 승인된 formulary만 활성화한다.

판매량과 마진은 임상 적합성 또는 안전 eligibility를 바꾸지 않는다. runtime의 sales rank는 안전하고 임상적으로 동등한 제품의 마지막 tie-break에만 사용한다.

## Dev pack

```powershell
corepack pnpm pack:lint
corepack pnpm pack:build:dev
corepack pnpm pack:verify
```

dev 명령은 임시 Ed25519 private key를 메모리에서 만들고 즉시 폐기한다. 결과는 synthetic·clinical-use-prohibited다. synthetic fixture의 성분명·제품명·claim은 테스트 전용이며 실제 임상 지식으로 해석하지 않는다.

Production은 `docs/DATA_SOURCE_ACTIVATION.md`와 `docs/FORMULARY_RUNBOOK.md`의 preflight를 통과한 후 외부 KMS/HSM private key로 canonical payload를 서명한다. public key만 runtime에 배포하고, 정상 pack 최대 3개를 보존하되 rollback 시에도 최신 activation gate를 다시 적용한다.
