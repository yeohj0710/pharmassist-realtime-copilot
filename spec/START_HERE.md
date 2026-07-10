# START HERE

## Codex/GPT-5.6에 넘길 때

1. 이 폴더 전체 또는 ZIP을 작업 컨텍스트에 넣는다.
2. `codex/COPY_PASTE_START_PROMPT.txt`를 첫 메시지로 붙여 넣는다.
3. 구현 에이전트가 `codex/MASTER_IMPLEMENTATION_PROMPT.md`와 전체 spec을 읽고 실제 monorepo를 만들게 한다.
4. 완료 판정은 `codex/ACCEPTANCE_CRITERIA.md`와 생성될 `docs/TRACEABILITY_MATRIX.md`로 한다.

## 가장 중요한 전제

- v1은 자체 모델 학습이 아니라 OpenAI API wrapper + deterministic local engine이다.
- 첫 유용 카드는 로컬에서 즉시 표시하고 OpenAI는 선택적 보정만 한다.
- 첨부 자료는 production truth가 아니라 후보 구조/표현 자료다.
- 실제 임상 배포에는 최신 공식 제품·DUR·지침 데이터와 약사 검수, 개인정보·규제 검토가 추가로 필요하다.
- `examples/`와 `knowledge_seed/`는 합성 또는 candidate-only이며 임상 사용 금지다.

## 주요 산출물

- 전체 결론: `MASTER_HANDOFF.md`
- 구현 프롬프트: `codex/MASTER_IMPLEMENTATION_PROMPT.md`
- 완료 기준: `codex/ACCEPTANCE_CRITERIA.md`
- 파일별 분석: `SOURCE_AUDIT.csv`
- 아키텍처/안전/지연시간/API: `docs/`
- 런타임·오프라인 프롬프트: `prompts/`
- 73개 intent/219개 alias candidate seed: `knowledge_seed/`
- 50개 golden + 50개 adversarial behavior test: `examples/`, `tests/`
