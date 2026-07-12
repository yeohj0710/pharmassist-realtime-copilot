# Benchmarks

`corepack pnpm benchmark`가 `reports/benchmark.json`과 `reports/benchmark.md`를 만든다. 2026-07-10 Windows/Node 24 synthetic in-process 결과는 exact P95 0.019ms, fuzzy P95 0.027ms, voice-text P95 0.031ms였다.

이 수치는 local engine 계산만 측정한다. 마이크, ASR, network, UI paint, cold browser, production pack을 포함하지 않는다. 따라서 target 약국 기기 성능 인증으로 사용할 수 없다.

Release 전 실제 target device에서 exact ≤250ms, fuzzy ≤400ms, stable voice prefix 이후 ≤700ms, cold pack load ≤1.5s를 측정한다. UI render ≤16ms와 memory/pack size도 별도로 기록한다.
