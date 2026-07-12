# Incident and rollback

안전 문제가 의심되면 기능 확장보다 노출 중단이 먼저다.

1. 영향 card/version/tenant를 식별하고 reason code를 기록한다.
2. publisher/admin이 revocation endpoint로 card를 kill-switch 한다.
3. active pack을 마지막 verified pack으로 atomic rollback 한다.
4. OpenAI refinement/realtime feature flag를 끈다. local safety 경로는 유지한다.
5. audit event와 metric만 보존하고 환자 원문을 incident log에 복사하지 않는다.
6. root cause, affected claim/source, 수정 pack, pharmacist+medical approval을 확인한다.
7. staged smoke/golden/adversarial/benchmark 후 새 semantic version을 publish한다.

DB backup은 `pg_dump --format=custom`; restore는 격리 DB에 `pg_restore --clean --if-exists` 후 migration/version/hash를 검증한다. signed pack 파일은 object-lock/versioning 저장소와 별도 public-key inventory에 백업한다.

자동 retry는 idempotent read/refinement에 bounded jitter로만 사용한다. publish/rollback/revoke는 자동 retry하지 않는다.
