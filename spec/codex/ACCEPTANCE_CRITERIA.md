# Acceptance Criteria

이 문서는 구현 완료 여부를 판정하는 release contract다. 각 항목은 `docs/TRACEABILITY_MATRIX.md`에서 코드·테스트·실행 증거와 연결되어야 한다.

표기:
- **AUTO:** CI에서 자동 검증
- **BENCH:** 정의된 benchmark 환경에서 검증
- **MANUAL:** 약사/보안/법무 등 사람 gate
- **EXTERNAL:** credential, official dataset, 계약 등 외부 의존성

## A. Repository and reproducibility

- **AC-A001 AUTO** clean clone에서 문서화된 단일 명령으로 dependency 설치가 성공한다.
- **AC-A002 AUTO** lockfile이 존재하고 CI와 local이 같은 package manager를 사용한다.
- **AC-A003 AUTO** lint, format check, typecheck, unit test, build가 green이다.
- **AC-A004 AUTO** TypeScript strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`가 활성화된다.
- **AC-A005 AUTO** core packages에 implicit/explicit `any`가 없다. 외부 boundary는 `unknown`+validation이다.
- **AC-A006 AUTO** 완료 branch에 TODO/FIXME/not-implemented stub가 없다.
- **AC-A007 AUTO** `.env.example`에는 secret이 없고 실제 `.env`, keys, raw sources가 gitignored다.
- **AC-A008 AUTO** local demo가 외부 OpenAI key 없이 실행된다.
- **AC-A009 AUTO** Docker/Compose profile이 non-root container로 기동한다.
- **AC-A010 AUTO** SBOM과 dependency/security scan artifact가 생성된다.

## B. Contract and schema integrity

- **AC-B001 AUTO** 제공 JSON Schema가 source of truth이고 generated TS type와 drift하지 않는다.
- **AC-B002 AUTO** RuntimeInput/Output, Source, Claim, Product, Card의 valid/invalid fixtures가 검증된다.
- **AC-B003 AUTO** API request와 response가 모두 runtime schema validation을 거친다.
- **AC-B004 AUTO** OpenAI output도 동일 RuntimeOutput schema strict validation을 거친다.
- **AC-B005 AUTO** unknown/additional properties가 fail된다.
- **AC-B006 AUTO** OpenAPI 3.1 문서가 생성되고 API와 contract test로 비교된다.
- **AC-B007 AUTO** error response가 typed code, request ID, retryable, safe fallback을 가진다.
- **AC-B008 AUTO** UUID/date-time/enum/range validation이 활성화된다.
- **AC-B009 AUTO** schema/prompt/knowledge/app version이 result와 audit metadata에서 추적된다.

## C. Deterministic local runtime

- **AC-C001 AUTO** web local engine은 OpenAI/network 없이 normalize→safety→retrieve→render를 수행한다.
- **AC-C002 AUTO** engine은 Web Worker에서 실행되며 main thread가 search를 수행하지 않는다.
- **AC-C003 AUTO** server `/consult/instant`가 동일 core package를 사용한다.
- **AC-C004 AUTO** Unicode/spacing/unit/number/age/weight/time normalization tests가 통과한다.
- **AC-C005 AUTO** Korean IME composition 중 premature search가 발생하지 않는다.
- **AC-C006 AUTO** alias confusion은 alternatives를 보존하며 불확실한 교정을 확정하지 않는다.
- **AC-C007 AUTO** exact lookup, multi-pattern lookup, rules, BM25, trigram candidate가 구현된다.
- **AC-C008 AUTO** match feature와 score가 재현 가능하다.
- **AC-C009 AUTO** safety result는 retrieval score로 상쇄되지 않는다.
- **AC-C010 AUTO** no-match/ambiguous 결과가 안전하게 표시된다.
- **AC-C011 AUTO** freeze 후 자동 intent/card 교체가 금지된다.
- **AC-C012 AUTO** hysteresis margin 미만의 partial 변화로 카드가 흔들리지 않는다.
- **AC-C013 AUTO** critical red flag는 debounce를 우회한다.
- **AC-C014 AUTO** newer sequence 이후 도착한 local/network result가 폐기된다.
- **AC-C015 AUTO** worker crash/restart 후 verified pack으로 복구한다.

## D. Clinical safety gates

- **AC-D001 AUTO** triage/red-flag gate가 action/recommendation보다 먼저 실행된다.
- **AC-D002 AUTO** 응급 match 시 일반약/제품 action이 숨거나 blocked된다.
- **AC-D003 AUTO** negated red flag가 양성으로 오인되지 않고 double negation test가 있다.
- **AC-D004 AUTO** 과거력, 가족/동행인, 가능성 표현이 현재 환자 양성 signal과 구별된다.
- **AC-D005 AUTO** blocking slot이 비면 연결된 고위험 action이 출력되지 않는다.
- **AC-D006 AUTO** 체중·제품·농도 없이 소아 mL/용량 숫자가 출력되지 않는다.
- **AC-D007 AUTO** exact verified product 없이 제품별 복용법/누락 규칙이 출력되지 않는다.
- **AC-D008 AUTO** 임신·수유 rule이 verified claim/slot 없이 생성되지 않는다.
- **AC-D009 AUTO** allergy/contraindication/interaction hooks가 fail-closed한다.
- **AC-D010 AUTO** 외형만으로 약물 식별/진단하는 카드가 compile/runtime에서 차단된다.
- **AC-D011 AUTO** human/animal/supplement/Rx domain leak가 compile/runtime에서 모두 차단된다.
- **AC-D012 AUTO** revenue/inventory metadata가 clinical ranking score에 들어가지 않는다.
- **AC-D013 AUTO** 진단 단정/처방 변경/자가 중단을 임의 생성하는 output이 rejected된다.
- **AC-D014 AUTO** expired/revoked/conflicted/unapproved claim/card가 runtime unavailable이다.
- **AC-D015 AUTO** source locator 없는 claim은 publish 불가다.
- **AC-D016 AUTO** critical safety gold recall 목표가 test report에 계산된다.
- **AC-D017 AUTO** production profile에서 synthetic/placeholder가 한 건이라도 있으면 build/startup이 fail한다.
- **AC-D018 MANUAL** 면허 약사가 red flag, blocking slots, wording을 검수한다.
- **AC-D019 MANUAL** high-risk cards는 pharmacist + medical safety approval이 모두 있다.

## E. Knowledge provenance and lifecycle

- **AC-E001 AUTO** Source→Claim→Card를 양방향 추적할 수 있다.
- **AC-E002 AUTO** A/B/C/D/X 정책이 compiler에서 강제된다.
- **AC-E003 AUTO** published card의 clinical source tier는 A/B만 허용된다.
- **AC-E004 AUTO** C 자료는 wording/workflow candidate 외 임상 truth가 될 수 없다.
- **AC-E005 AUTO** D 자료는 vocabulary/metadata 외 clinical claim이 될 수 없다.
- **AC-E006 AUTO** X 자료는 runtime pack에서 제외된다.
- **AC-E007 AUTO** conflict set이 unresolved면 publish가 실패한다.
- **AC-E008 AUTO** 숫자 충돌을 평균/다수결로 해결하지 않는다.
- **AC-E009 AUTO** product/formulation/population/jurisdiction/date split을 표현할 수 있다.
- **AC-E010 AUTO** approval/verification/expiry/reviewer가 필수다.
- **AC-E011 AUTO** claim change가 dependent cards/tests를 stale한다.
- **AC-E012 AUTO** pack은 immutable semantic version을 가진다.
- **AC-E013 AUTO** canonical manifest/hash/Ed25519 signature가 검증된다.
- **AC-E014 AUTO** invalid signature/schema/smoke test pack은 활성화되지 않는다.
- **AC-E015 AUTO** pack update는 atomic하고 실패하면 기존 버전을 유지한다.
- **AC-E016 AUTO** 이전 정상 pack 2개 이상 rollback이 된다.
- **AC-E017 AUTO** card revocation/kill switch가 즉시 적용된다.
- **AC-E018 AUTO** private signing key가 client/bundle/repo에 없다.
- **AC-E019 EXTERNAL** 실제 official source import의 라이선스/이용조건이 기록된다.
- **AC-E020 MANUAL** production pack은 정해진 reviewer/publisher separation을 통과한다.

## F. OpenAI Responses integration

- **AC-F001 AUTO** official SDK adapter가 interface 뒤에 있고 mock provider로 대체 가능하다.
- **AC-F002 AUTO** model IDs/reasoning/timeout/token limit가 config에만 존재한다.
- **AC-F003 AUTO** 요청에 `store:false`가 설정됨을 contract test가 검증한다.
- **AC-F004 AUTO** persistent conversation/background/vector store가 default off다.
- **AC-F005 AUTO** strict RuntimeOutput schema가 요청에 연결된다.
- **AC-F006 AUTO** streaming delta가 current sequence에만 적용된다.
- **AC-F007 AUTO** AbortController가 이전 요청을 취소한다.
- **AC-F008 AUTO** timeout/schema error/provider error에서 instant card가 유지된다.
- **AC-F009 AUTO** output claim/source refs가 request allowlist의 부분집합이다.
- **AC-F010 AUTO** red-flag/missing-slot safety 수준을 모델이 낮추면 reject된다.
- **AC-F011 AUTO** allowlist에 없는 숫자/제품/성분/의학 entity를 추가하면 reject된다.
- **AC-F012 AUTO** patient/source prompt injection이 system behavior를 바꾸지 못한다.
- **AC-F013 AUTO** raw request/response body가 logs/traces에 없다.
- **AC-F014 AUTO** exact/high-confidence local path에서는 Responses call이 발생하지 않는다.
- **AC-F015 AUTO** Luna/Terra/offline model routing이 config와 policy대로 동작한다.
- **AC-F016 EXTERNAL** live OpenAI integration은 opt-in test와 사용 조직 설정으로 검증된다.

## G. Realtime transcription

- **AC-G001 AUTO** push-to-talk가 default이고 always-listening은 false다.
- **AC-G002 AUTO** 브라우저 bundle/network response에 standard API key가 없다.
- **AC-G003 AUTO** browser media transport는 WebRTC adapter다.
- **AC-G004 AUTO** server broker는 authenticated/rate-limited short-lived session만 만든다.
- **AC-G005 AUTO** transcript delta/final/out-of-order/duplicate/reconnect reducer tests가 있다.
- **AC-G006 AUTO** stable-prefix detector가 정의되고 event replay test를 통과한다.
- **AC-G007 AUTO** partial critical signal이 safety gate에 전달된다.
- **AC-G008 AUTO** uncertain medication name은 alternatives를 유지한다.
- **AC-G009 AUTO** Realtime은 임상 답변을 만들지 않고 transcription만 한다.
- **AC-G010 AUTO** PTT 종료/상담 종료 시 media track/buffer/transcript memory가 지워진다.
- **AC-G011 AUTO** app server/database에 audio blob/table이 없다.
- **AC-G012 AUTO** Realtime failure 시 typed input으로 fallback한다.
- **AC-G013 AUTO** fake realtime source로 CI/E2E가 외부 API 없이 통과한다.
- **AC-G014 BENCH** stable prefix 이후 local first card latency를 측정한다.
- **AC-G015 MANUAL** 한국어 약국 소음/마스크/노년층/제품명 음성 corpus로 평가한다.

## H. Privacy and security

- **AC-H001 AUTO** patient name/phone/address/RRN/email/payment fields가 runtime schema/DB에 없다.
- **AC-H002 AUTO** PII detector/redactor tests가 있다.
- **AC-H003 AUTO** redaction confidence가 부족하면 external refinement가 차단된다.
- **AC-H004 AUTO** feedback endpoint가 free text/patient identifiers를 거부한다.
- **AC-H005 AUTO** logs/spans/metrics는 content-free allowlist serializer를 사용한다.
- **AC-H006 AUTO** automated leakage test가 input transcript/query가 logs에 없는지 확인한다.
- **AC-H007 AUTO** auth roles와 tenant isolation tests가 있다.
- **AC-H008 AUTO** reviewer/publisher 권한이 분리된다.
- **AC-H009 AUTO** admin endpoints는 pharmacist role만으로 접근할 수 없다.
- **AC-H010 AUTO** secure headers/CSP/CORS/CSRF/rate limit이 profile에 맞게 적용된다.
- **AC-H011 AUTO** secret scanning이 client key/private signing key를 탐지한다.
- **AC-H012 AUTO** consultation/refinement response는 `Cache-Control: no-store`다.
- **AC-H013 AUTO** input length/rate limits와 denial-of-service bounds가 있다.
- **AC-H014 AUTO** pack/path traversal/zip bomb/unsafe file import protections가 있다.
- **AC-H015 AUTO** threat model이 prompt injection, supply chain, malicious pack, insider publish, XSS, tenant leak를 다룬다.
- **AC-H016 MANUAL** 마이크 고지/동의 문구와 개인정보 처리 흐름을 검토한다.
- **AC-H017 EXTERNAL** OpenAI retention/ZDR/MAM/contract/cross-border conditions를 운영 조직이 확인한다.
- **AC-H018 MANUAL** 한국 개인정보·민감정보·규제 법률 검토를 기록한다.

## I. UI/UX and accessibility

- **AC-I001 AUTO** 첫 화면 순서는 say now → ask next → red flags/actions → avoid → source/version이다.
- **AC-I002 AUTO** long reasoning/source passages가 first screen에 없다.
- **AC-I003 AUTO** provisional/stable/blocked/final이 색상 외 텍스트/아이콘으로 구별된다.
- **AC-I004 AUTO** critical state는 다른 결과가 확인 없이 덮어쓰지 못한다.
- **AC-I005 AUTO** keyboard-only core flow가 Playwright로 검증된다.
- **AC-I006 AUTO** focus management와 ARIA labels가 있다.
- **AC-I007 AUTO** PTT/mic active 상태가 항상 보인다.
- **AC-I008 AUTO** offline/degraded badge가 local content를 숨기지 않는다.
- **AC-I009 AUTO** source/version/verified date 상세 패널이 있다.
- **AC-I010 AUTO** synthetic demo에는 명확한 임상사용 금지 watermark가 있다.
- **AC-I011 AUTO** error message가 내부 stack/provider payload를 노출하지 않는다.
- **AC-I012 MANUAL** 카운터 거리 가독성, 깜빡임, 카드 안정성을 약사가 평가한다.

## J. API and operations

- **AC-J001 AUTO** 모든 필수 `/v1` endpoint가 구현된다.
- **AC-J002 AUTO** `/health/live`와 `/health/ready`의 semantics가 구분된다.
- **AC-J003 AUTO** OpenAI down은 local core readiness를 not-ready로 만들지 않는다.
- **AC-J004 AUTO** pack endpoint는 immutable cache/ETag를 사용한다.
- **AC-J005 AUTO** consultation endpoint는 LLM 없이 timeout bound를 지킨다.
- **AC-J006 AUTO** feedback는 coded outcome/reason only다.
- **AC-J007 AUTO** publish/rollback/revoke에는 role, reason, audit event가 필요하다.
- **AC-J008 AUTO** migrations/seed/backup/restore instructions가 동작한다.
- **AC-J009 AUTO** graceful shutdown이 active stream/media/session을 정리한다.
- **AC-J010 AUTO** retry는 bounded/jittered이고 unsafe admin action을 자동 재시도하지 않는다.
- **AC-J011 AUTO** incident kill switch와 rollback drill test가 있다.
- **AC-J012 AUTO** production startup은 missing official pack/signature/config에서 fail closed한다.

## K. Performance and reliability

- **AC-K001 BENCH** typed exact/rule P95 ≤ 250ms.
- **AC-K002 BENCH** local fuzzy P95 ≤ 400ms.
- **AC-K003 BENCH** stable voice prefix 이후 local card P95 ≤ 700ms under declared profile.
- **AC-K004 BENCH** UI commit/render P95 목표 ≤ 16ms를 측정한다.
- **AC-K005 BENCH** compact pack cold load P95 ≤ 1.5s under declared hardware.
- **AC-K006 BENCH** memory/pack size limits을 측정하고 문서화한다.
- **AC-K007 AUTO** network LLM이 exact path critical timing에 포함되지 않는다.
- **AC-K008 AUTO** refinement timeout default 2.5s and local fallback.
- **AC-K009 AUTO** race/fuzz tests에서 stale overwrite 0건이다.
- **AC-K010 AUTO** offline reload와 previous pack fallback E2E가 통과한다.
- **AC-K011 AUTO** benchmark 결과 JSON과 Markdown report가 생성된다.
- **AC-K012 MANUAL** 실제 target device/network에서 release benchmark를 수행한다.

## L. Documentation and evidence

- **AC-L001 AUTO** root README에 setup/run/test/build/benchmark 명령이 있다.
- **AC-L002 AUTO** architecture/data flow/threat model/intended use/limitations 문서가 있다.
- **AC-L003 AUTO** OpenAI integration 문서가 model/config/privacy/fallback을 설명한다.
- **AC-L004 AUTO** knowledge authoring/review/sign/publish/rollback runbook이 있다.
- **AC-L005 AUTO** incident response와 card revocation 절차가 있다.
- **AC-L006 AUTO** legal/privacy review checklist가 있다.
- **AC-L007 AUTO** acceptance traceability matrix가 모든 ID를 코드/테스트/증거에 매핑한다.
- **AC-L008 AUTO** implementation report에 실제 실행 명령과 결과가 있다.
- **AC-L009 AUTO** known limitations가 구현 미완료와 external gate를 구별한다.
- **AC-L010 MANUAL** 약사 교육/운영자 배포 절차가 검토된다.

## Release gate

다음은 production release의 필수 조건이다.

1. AUTO 항목 green.
2. target 환경 BENCH 목표 충족 또는 safety-preserving remediation 승인.
3. MANUAL 약사·보안·개인정보·규제 review 기록.
4. EXTERNAL official source/license/OpenAI data control/계약 조건 확인.
5. synthetic/placeholder 0건.
6. published cards의 A/B source, locator, current verification, expiry, two-person approval 100%.
7. critical red-flag recall과 numeric/blocking safety 목표 충족.

애플리케이션 코드가 완성되어도 위 external/manual gate가 없으면 `production clinical ready`로 표시하지 않는다.
