import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import type { RuntimeInput } from "@pharmassist/contracts";
import { LocalClinicalEngine } from "@pharmassist/runtime";
import { syntheticPack } from "@pharmassist/test-fixtures";

const engine = new LocalClinicalEngine(syntheticPack);
const samples = {
  exact: [] as number[],
  fuzzy: [] as number[],
  voice: [] as number[],
};
const make = (text: string, sequence: number, voice = false): RuntimeInput => ({
  request_id: crypto.randomUUID(),
  session_id: "benchmark",
  sequence,
  input_type: voice ? "voice_final" : "typed",
  text,
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: new Date().toISOString(),
});
for (let index = 0; index < 100; index += 1) engine.run(make("기침", index));
for (let index = 0; index < 1500; index += 1) {
  for (const [name, text, voice] of [
    ["exact", "기침", false],
    ["fuzzy", "기치미 사흘째", false],
    ["voice", "기침이 삼일째예요", true],
  ] as const) {
    const start = performance.now();
    engine.run(make(text, index, voice));
    samples[name].push(performance.now() - start);
  }
}
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.ceil(values.length * p) - 1)
  ] ?? 0;
const metric = (values: number[], target: number) => ({
  samples: values.length,
  p50_ms: +percentile(values, 0.5).toFixed(3),
  p95_ms: +percentile(values, 0.95).toFixed(3),
  p99_ms: +percentile(values, 0.99).toFixed(3),
  target_ms: target,
  pass: percentile(values, 0.95) <= target,
});
const report = {
  generated_at: new Date().toISOString(),
  profile: {
    node: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model ?? "unknown",
    logical_cpus: cpus().length,
    memory_gb: +(totalmem() / 1024 ** 3).toFixed(1),
    pack: "synthetic-demo",
  },
  metrics: {
    typed_exact: metric(samples.exact, 250),
    local_fuzzy: metric(samples.fuzzy, 400),
    stable_voice_prefix: metric(samples.voice, 700),
  },
  limitations: [
    "Synthetic in-process benchmark; excludes microphone, ASR, UI paint, network, and production knowledge pack.",
    "Release benchmark must run on the declared target device.",
  ],
};
const out = resolve(import.meta.dirname, "../../../reports");
await mkdir(out, { recursive: true });
await writeFile(
  resolve(out, "benchmark.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const rows = Object.entries(report.metrics)
  .map(
    ([name, m]) =>
      `| ${name} | ${m.p50_ms} | ${m.p95_ms} | ${m.target_ms} | ${m.pass ? "PASS" : "FAIL"} |`,
  )
  .join("\n");
await writeFile(
  resolve(out, "benchmark.md"),
  `# Local benchmark\n\nGenerated: ${report.generated_at}\n\n| Path | P50 ms | P95 ms | Target ms | Result |\n|---|---:|---:|---:|---|\n${rows}\n\n> Synthetic local evidence only. Not a clinical-production or target-device certification.\n`,
);
console.log(JSON.stringify(report.metrics));
