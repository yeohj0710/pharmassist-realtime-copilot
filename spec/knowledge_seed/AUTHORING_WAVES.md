# Authoring Waves

## Wave 0 — Safety shell

실제 제품 추천 없이 다음만 먼저 구축한다.

- no-match/모호성/제품 식별 실패
- blocking slot cards
- domain mismatch
- critical red-flag routing
- 과량복용/오인섭취 공식 대응 경로
- source/claim/card review, expiry, revoke, rollback

이 단계가 gold/adversarial tests를 통과하기 전 symptom recommendation 카드를 만들지 않는다.

## Wave 1 — High-frequency, low-complexity OTC conversation structure

감기·콧물·기침·인후통·소화불량·속쓰림·설사·변비·통증·피부·치질 등의 **질문 순서와 환자 친화 문구**를 C 자료에서 candidate로 만들고, 모든 임상 claim/red flag/action은 current A/B source로 교체한다. 제품별 숫자는 넣지 않는다.

## Wave 2 — High-risk/product-specific cards

소아, 임신·수유, 경구피임제, 제품별 용량/농도, 중복성분, 복용 누락을 다룬다. exact product ID, official label version, required slots, deterministic calculation fixture, pharmacist+medical-safety approval이 모두 있어야 한다.

## Wave 3 — Separate domains

처방 복약지도와 건기식은 별도 feature flag/pack/reviewer matrix/test suite로 구축한다. 건기식은 질환 치료 표현을 허용하지 않는다. 동물약은 수의학 검수와 별도 제품 없이는 구현하지 않는다.

## Excluded

외형·체질·얼굴색·혀·‘기운’만으로 질환/결핍을 추정하는 자료, 판촉성 효능/복합판매, 검증되지 않은 영양소 부작용 표는 production authoring queue에서 제외한다.
