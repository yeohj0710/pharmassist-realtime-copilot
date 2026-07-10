# Test Plan

테스트의 목적은 “그럴듯한 답변”이 아니라 **위험한 상태에서 안전하게 멈추고, 현재 입력에 맞는 승인 카드를 빠르게 유지하는지** 증명하는 것이다.

## Test pyramid

1. Pure unit/property tests: normalizer, negation, slots, safety, retrieval, pack policy.
2. Golden/adversarial behavior: exact output text보다 mode/rule/block/allowlist invariants를 검증.
3. Integration: API schemas, model mock, DB/reviewer, pack signing.
4. E2E: keyboard, PTT event replay, offline PWA, update/rollback.
5. Benchmarks: local path와 network refinement를 분리.
6. Manual gates: pharmacist content review, noisy Korean audio, privacy/legal/regulatory.

## Release-critical assertions

- Red flag가 recommendation보다 먼저 평가된다.
- 부정·과거·타인 증상을 현재 양성으로 처리하지 않는다.
- blocking slot이 없으면 숫자·제품별 rule이 없다.
- 모델이 새로운 number/entity/source를 추가하면 reject한다.
- stale response가 현재 화면을 덮지 않는다.
- synthetic/expired/revoked/conflicted pack은 production에서 fail한다.
- patient text/audio/transcript가 logs/traces/feedback/DB에 없다.
- OpenAI 없이 typed local core가 계속 동작한다.

## Evidence

각 test는 acceptance ID를 tag로 가진다. CI는 JUnit/JSON report와 benchmark JSON을 남기고 traceability matrix가 orphan ID/test를 검사한다.
