# OpenAI integration

OpenAI는 선택적 refinement와 음성→텍스트에만 쓴다. safety, claim 선택, numeric 결정, pack 게시 권한은 모델에 주지 않는다.

## Responses

- 기본 model: `gpt-5.4-mini`; ambiguity/authoring: `gpt-5.5`
- timeout 2.5초, max output 420, `store:false`
- RuntimeOutput JSON Schema strict format
- request allowlist 밖 claim/source/entity/숫자, red-flag 약화, missing slot 제거를 post-validator가 거부
- timeout/schema/provider 오류면 instant local card 유지

## Realtime transcription

- `gpt-realtime-whisper`, transcription session only
- 브라우저는 PTT WebRTC offer를 API에 보냄
- API만 표준 key를 보유하고 `/v1/realtime/calls`에 multipart SDP/session을 전달
- item/event ID reducer가 duplicate·out-of-order item·disconnect를 처리
- 실패하면 media track을 닫고 typed input으로 복귀

활성화:

1. 조직의 retention/ZDR/MAM, 국외 이전, 계약 조건을 승인한다.
2. server secret store에 `OPENAI_API_KEY`와 `OPENAI_SAFETY_IDENTIFIER_SECRET`을 둔다.
3. `FEATURE_LLM_REFINEMENT=true`, `FEATURE_REALTIME_TRANSCRIPTION=true`를 staging에서만 먼저 켠다.
4. web에 `VITE_REALTIME_BROKER_URL=/v1/realtime/session`을 설정한다.
5. synthetic live tests와 보안 review 후 점진 활성화한다.

공식 확인 자료: [Models](https://developers.openai.com/api/docs/models), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription). 2026-07-10 확인. live credential test는 실행하지 않았다.
