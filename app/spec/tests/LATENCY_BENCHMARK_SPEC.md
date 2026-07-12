# Latency Benchmark Specification

## Clock boundaries

- typed `t0`: IME composition이 끝나고 routable stable query event가 worker에 전송된 시점
- voice `t0`: stable transcript prefix event가 worker에 전송된 시점
- `t1`: 첫 유용 `RuntimeOutput`이 main thread store에 commit된 시점
- render `t2`: 해당 카드의 browser paint가 완료된 시점

네트워크 전사 이전 시간과 환자가 필요한 단어를 말하기 전 시간은 local engine SLA에 포함하지 않는다. Responses refinement는 별도 지표다.

## Corpus

- exact aliases, synonyms, typo/spacing, Korean number/unit variants
- negative/red-flag/person/temporality cases
- 1k/5k/20k synthetic card pack profiles
- cold start and warm index
- stable voice event replays

## Method

- fixed hardware/browser/OS metadata 기록
- warm-up 후 최소 1,000 iterations/category
- performance.now monotonic clock
- p50/p95/p99/max, memory, GC outlier 기록
- main-thread long task와 worker time 분리
- CI regression과 release target device benchmark 분리
- no OpenAI call in local benchmark

## Targets

| Path | P95 |
|---|---:|
| typed exact/rule | 250ms |
| local fuzzy | 400ms |
| voice after stable prefix | 700ms |
| UI commit/paint | 16ms target |
| compact pack cold load | 1500ms |

실패 시 LLM reasoning을 줄이는 것으로 local latency를 고치지 말고 index size, serialization, worker transfer, rendering을 profile한다.
