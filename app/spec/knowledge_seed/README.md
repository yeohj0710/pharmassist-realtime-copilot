# Knowledge Seed — Candidate Taxonomy Only

이 폴더는 첨부 자료에서 확인한 주제 구조를 바탕으로 만든 **저작 큐·intent/alias/slot seed**다. 임상 사실, 용량, 금기, 상호작용, 제품별 규칙을 담지 않는다.

- 모든 행은 `candidate` 또는 `template`이며 production knowledge가 아니다.
- `source_refs`는 “이 주제가 자료에 등장했다”는 provenance일 뿐 정확성 보증이 아니다.
- 실제 카드의 `say_now`, red flags, actions, 숫자, 제품 규칙은 최신 A/B 출처와 약사 이중 검수 후 별도 생성한다.
- 짧은 alias는 합성한 환자 표현으로, 저작팀이 현장 로그 없이도 local retrieval을 구현·테스트하기 위한 것이다.
- 환자 실제 발화 로그를 alias mining에 사용할 경우 별도 적법성·비식별·보유 정책이 필요하다.

## 파일

- `INTENT_INVENTORY_CANDIDATE.csv` — 구현/저작 우선순위와 source map
- `ALIAS_SEED_CANDIDATE.csv` — deterministic retrieval용 합성 alias seed
- `SLOT_TAXONOMY.csv` — 구조화 input slot 초안
- `AUTHORING_WAVES.md` — 안전한 knowledge 구축 순서
