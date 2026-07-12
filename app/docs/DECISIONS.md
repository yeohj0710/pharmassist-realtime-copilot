# Decisions

| 결정            | 선택                                                      | 이유                                               |
| --------------- | --------------------------------------------------------- | -------------------------------------------------- |
| 런타임          | local-first deterministic                                 | 모델 지연·실패가 즉시 카드와 safety를 막지 않게 함 |
| 지식            | immutable signed pack                                     | provenance, rollback, kill switch를 명확히 함      |
| 외부 refinement | optional, redacted, `store:false`                         | 개인정보 최소화와 local fallback 유지              |
| 음성            | push-to-talk, transcription only                          | always-listening과 audio persistence를 기본 차단   |
| 데이터          | coded feedback/audit only                                 | 환자 원문 DB·로그 저장을 구조적으로 피함           |
| 모델 ID         | 공개 GA `gpt-5.4-mini`, `gpt-5.5`, `gpt-realtime-whisper` | 사양의 비공개/미확인 이름을 허위 사용하지 않음     |
| 데모            | synthetic only, visible watermark                         | 공식 데이터가 없는 상태를 숨기지 않음              |
