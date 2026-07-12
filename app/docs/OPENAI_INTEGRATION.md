# OpenAI integration

OpenAI는 선택적 refinement와 음성→텍스트에만 쓴다. safety, claim 선택, numeric 결정, pack 게시 권한은 모델에 주지 않는다.

## Responses

- 기본 model: `gpt-5-nano`; 대화 전체를 해석하는 주 상담 엔진. 로컬 카드와 제공 자료는 참고 문맥으로 사용한다.
- 로컬 결과는 즉시 표시하고 조건부 AI fallback만 최대 5초, max output 420, `store:false`
- 기본 비용 guard: refinement 60회/시간, realtime session 20회/시간. 환경변수로 더 낮출 수 있으며 코드상 최대치는 각각 300/100이다.
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

## 비용 기본값

- `FEATURE_LLM_REFINEMENT=false`, `FEATURE_REALTIME_TRANSCRIPTION=false`: 기본 데모에서는 API 호출과 비용이 없다.
- runtime refinement는 비용·속도 우선 `gpt-5-nano`, 최대 420 output token을 사용한다. 전체 대화를 우선 해석하고 카드·자료는 선택적 참고로 제공한다. 로컬 코드는 응급 escalation, 요청 순서, 출처 ID만 강제한다. 결과를 임상 production-ready로 간주하지 않는다.
- 서버가 `OPENAI_REFINEMENT_MAX_REQUESTS_PER_HOUR=60`, `OPENAI_REALTIME_MAX_SESSIONS_PER_HOUR=20`을 강제한다.
- 더 보수적으로 쓰려면 각각 `20`, `10`으로 낮춘다.
- 서버 제한은 프로세스별 보호장치다. 계정 전체 지출 한도와 알림은 OpenAI 프로젝트 설정에서도 별도로 구성한다.

공식 확인 자료: [Models](https://developers.openai.com/api/docs/models), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription). 2026-07-10 확인. live credential test는 실행하지 않았다.
