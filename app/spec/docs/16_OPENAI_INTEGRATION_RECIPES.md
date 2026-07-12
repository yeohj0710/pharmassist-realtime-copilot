# 16. OpenAI Integration Recipes

**검증 기준일:** 2026-07-10  
이 문서의 코드는 설계용 TypeScript pseudocode다. 구현 시 공식 SDK의 현재 타입을 확인하고 `packages/openai-adapter` 내부에서만 API shape 차이를 흡수한다.

## 1. 모델 역할

| 역할 | 기본 모델 | 경로 | 이유 |
|---|---|---|---|
| 짧은 문장 보정 | `gpt-5.6-luna` | Responses | high-volume/low-latency refinement |
| 모호한 복합 질의 | `gpt-5.6-terra` | Responses | cost/intelligence balance |
| 오프라인 claim/card 후보 추출 | `gpt-5.6-sol` 또는 `gpt-5.6` | Responses | 복잡한 구조화·충돌 분석 |
| 실시간 전사 | `gpt-realtime-whisper` | Realtime transcription | low-latency transcript deltas |
| 전체 음성 에이전트 | 기본 비활성 | Realtime | v1 목표가 patient-facing voice agent가 아님 |

모델 ID는 환경설정으로 관리하고, 검증 후 snapshot을 pin한다. 모델 교체는 동일 schema/eval/latency/safety gate를 다시 통과해야 한다.

## 2. Responses refinement request

공식 Responses API에서 상태 저장을 끄고, strict JSON Schema를 `text.format`에 제공한다. 실제 환자 원문 대신 최소 redacted text, verified slots, instant output, allowlisted cards/claims만 보낸다.

```ts
const stream = await openai.responses.create({
  model: config.responsesModel,
  store: false,
  stream: true,
  reasoning: { effort: route === "ambiguous" ? "low" : "none" },
  max_output_tokens: config.maxOutputTokens,
  input: [
    { role: "system", content: promptRegistry.get("runtime-system") },
    { role: "developer", content: promptRegistry.get("runtime-refiner") },
    { role: "user", content: JSON.stringify(validatedMinimalPayload) }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "runtime_output",
      strict: true,
      schema: runtimeOutputSchema
    }
  }
}, { signal: abortController.signal });
```

코드가 반드시 추가할 제약:

- server timeout과 AbortController
- stale sequence check before every UI patch
- request/session/knowledge version equality
- claim/source allowlist subset
- red-flag 및 missing-slot monotonicity
- unsupported number/entity detector
- schema/error 시 instant output 유지
- request/response body logging 금지

Responses는 기본 상태 저장 동작과 조직별 데이터 통제 조건이 있으므로 `store:false`만으로 모든 보존 문제가 해결된다고 가정하지 않는다. OpenAI 조직의 Zero Data Retention/Modified Abuse Monitoring 자격·설정과 endpoint별 조건을 별도 확인한다.

## 3. WebRTC transcription connection

브라우저는 직접 standard API key를 갖지 않는다. 권장 흐름은 다음과 같다.

```text
Browser getUserMedia/PTT
  → RTCPeerConnection offer SDP
  → own server POST /v1/realtime/session
  → server combines SDP + approved session config
  → OpenAI /v1/realtime/calls with standard server key
  → answer SDP to browser
  → transcript delta/final events over data channel
```

서버의 session config는 transcription-only 역할을 강제한다.

- model: configured realtime transcription model
- language: Korean
- approved short vocabulary hint only
- no voice response generation
- privacy-preserving safety identifier
- short session lifetime/rate limit/auth

브라우저 reducer는 event type을 current official docs에서 가져오고 adapter type으로 변환한다. OpenAI event name을 UI/domain 코드 전역에 직접 퍼뜨리지 않는다.

## 4. Stable prefix and local routing

```ts
onTranscriptDelta(event) {
  const next = reducer.apply(event);
  const prefix = stablePrefixDetector.update(next);

  // Critical patterns may inspect partial text immediately,
  // but must carry negation/person/temporality evidence.
  worker.postMessage({
    type: "VOICE_UPDATE",
    sequence: session.sequence,
    partialText: next.partial,
    stablePrefix: prefix.text,
    alternatives: next.alternatives,
    isFinal: next.isFinal
  });
}
```

`stablePrefixDetector`는 다음을 조합한다.

- final segment
- 일정 시간 변경되지 않은 prefix
- 높은 confidence exact alias
- 기존 카드보다 충분한 score margin
- critical red flag는 debounce bypass

음성 SLA의 시작점은 환자가 발화를 시작한 순간이 아니라 **routable stable prefix가 local worker에 들어온 순간**이다.

## 5. Prompt registry

```ts
interface PromptDescriptor {
  promptId: string;
  version: string;
  sha256: string;
  path: string;
}
```

서버 시작 시 registry 파일과 실제 prompt bytes의 hash를 검증한다. 결과 metadata에는 prompt ID/version만 남기고 prompt body나 patient payload는 로그하지 않는다. prompt 변경은 eval과 reviewer 승인 없이 production에 배포하지 않는다.

## 6. Live test policy

기본 CI는 mock provider로 동작한다. live OpenAI tests는 다음 조건에서만 opt-in한다.

- 별도 test project/key
- synthetic input only
- low bounded request count
- explicit `OPENAI_LIVE_TESTS=true`
- model/SDK/API date recorded
- response body artifact 저장 금지
- latency/schema/error code만 report

## 7. Official references

URL과 검증일은 `references/OFFICIAL_REFERENCES.csv`에 있다. 반드시 다시 확인할 항목:

- current GPT-5.6 model IDs/reasoning support
- Realtime transcription model/event names
- browser WebRTC unified/ephemeral flow
- Responses streaming event types
- `text.format` Structured Outputs syntax
- `store:false`, retention, ZDR/MAM eligibility and limitations
