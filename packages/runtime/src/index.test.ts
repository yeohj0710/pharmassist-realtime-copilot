import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeInput } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { LocalClinicalEngine } from "./index.js";

const engine = new LocalClinicalEngine(syntheticPack);
const uuidA = "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349";
const uuidB = "c5beed71-acde-4a33-8c5a-a33ffdd81f6d";
const makeInput = (
  text: string,
  inputType: RuntimeInput["input_type"] = "typed",
  domain: RuntimeInput["domain"] = "human_otc",
): RuntimeInput => ({
  request_id: uuidA,
  session_id: uuidB,
  sequence: 1,
  input_type: inputType,
  text,
  is_partial: inputType === "voice_partial",
  locale: "ko-KR",
  domain,
  patient_context: {},
  asr:
    inputType === "voice_partial" && text.includes("페니")
      ? {
          confidence: 0.4,
          alternatives: ["페니라민", "페니실린"],
          stable_prefix_chars: 2,
        }
      : null,
  client_timestamp: "2026-07-10T00:00:00Z",
});

describe("deterministic local runtime", () => {
  it("runs all supplied golden cases without network and enforces mode/rule", () => {
    const path = resolve(
      import.meta.dirname,
      "../../test-fixtures/data/golden_cases.jsonl",
    );
    const cases = readFileSync(path, "utf8")
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    expect(cases).toHaveLength(50);
    for (const item of cases) {
      const result = engine.run(
        makeInput(item.input.text, item.input.input_type, item.input.domain),
      );
      expect(result.output.mode, item.case_id).toBe(item.expected.mode);
      expect(result.ruleIds, item.case_id).toContain(
        item.expected.must_trigger_rule,
      );
      expect(result.output.source_refs, item.case_id).toEqual([]);
      const clinicalNumeric = result.output.say_now
        .join(" ")
        .match(/\b\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc|정|회|일)\b/giu);
      expect(clinicalNumeric, item.case_id).toBeNull();
    }
  });

  it("fails closed when production loads synthetic knowledge", () => {
    expect(() => new LocalClinicalEngine(syntheticPack, "production")).toThrow(
      /official signed pack/u,
    );
  });
});
