# Examples — production data가 아님

이 폴더의 카드와 테스트는 **스키마·안전동작·개발 흐름을 보여주기 위한 합성 예시**다. 공식 허가사항이나 임상지침을 대신하지 않으며, `review.pharmacist_approved=false` 상태이므로 배포 빌드에 포함되면 실패하도록 구현해야 한다.

필수 CI 규칙:

1. `draft`, `sample`, `placeholder`, `REPLACE_WITH_...`가 들어간 카드가 production pack에 포함되면 빌드를 실패시킨다.
2. 고위험 claim에 A/B 출처, 검증일, 만료일, 약사 승인 중 하나라도 없으면 실패시킨다.
3. 소아 용량·임부·수유·금기·상호작용·응급분기 숫자 또는 규칙은 공식 제품/지침 검증 전 출력하지 않는다.
