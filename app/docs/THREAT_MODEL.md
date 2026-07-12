# Threat model

보호 자산은 환자 식별정보, 임상 claim 무결성, signing key, tenant 경계, 약사 계정, active pack이다. 브라우저↔API, API↔OpenAI, reviewer↔publisher, ingest↔pack compiler가 주요 trust boundary다.

| 위협             | 경로                         | 완화                                                                          | 남은 gate                    |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| Prompt injection | 환자/출처가 policy 변경 지시 | 입력은 data로 표시, model post-validator, no auto-publish                     | live red-team                |
| 악성 pack        | 변조·downgrade·zip bomb      | canonical SHA-256, Ed25519, path/size guard, atomic activation                | production KMS/HSM           |
| 내부자 게시      | reviewer가 직접 publish      | 역할 분리, reason code, audit event                                           | 실제 OIDC·승인자 지정        |
| Tenant leak      | forged tenant header         | local mock only, API boundary tests                                           | production JWT claim binding |
| PII 유출         | log/model/feedback           | redactor, fail-closed high-risk PII, no-store, allowlist logs, coded feedback | 개인정보 영향평가            |
| XSS              | transcript/source HTML       | React text escaping, CSP/helmet                                               | browser regression           |
| DoS              | 큰 body/regex/rate           | body bounds, bounded regex, rate limit, timeouts                              | edge/WAF policy              |
| Client key leak  | browser bundle               | key is server-only; SDP broker returns answer only                            | deployment secret scan       |
| Supply chain     | npm/action/image compromise  | lockfile, minimum release age, CI audit/SBOM                                  | digest pinning review        |

Production auth에서는 `x-role`/`x-tenant-id` mock header를 신뢰하면 안 된다. OIDC 서명·issuer·audience 검증 후 claim에서만 역할/tenant를 가져오도록 교체해야 한다.
