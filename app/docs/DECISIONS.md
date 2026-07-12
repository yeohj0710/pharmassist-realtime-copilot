# Decisions

| 결정            | 선택                                                                                | 이유                                                                                       |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 런타임          | local-first deterministic                                                           | 모델 지연·실패가 즉시 카드와 safety를 막지 않게 함                                         |
| 지식            | immutable signed pack                                                               | provenance, rollback, kill switch를 명확히 함                                              |
| 외부 refinement | optional, redacted, `store:false`                                                   | 개인정보 최소화와 local fallback 유지                                                      |
| 음성            | push-to-talk, transcription only                                                    | always-listening과 audio persistence를 기본 차단                                           |
| 데이터          | coded feedback/audit only                                                           | 환자 원문 DB·로그 저장을 구조적으로 피함                                                   |
| 모델 ID         | 대화 runtime `gpt-4.1-mini`, authoring `gpt-5.5`, transcription `gpt-4o-transcribe` | 전체 대화 해석은 AI가 주도하고 자료는 참고로 사용. 모델 결과를 임상 검증으로 간주하지 않음 |
| 데모            | synthetic only, visible watermark                                                   | 공식 데이터가 없는 상태를 숨기지 않음                                                      |
