import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeInput } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { LocalClinicalEngine } from "./index.js";

interface AdversarialCase {
  readonly case_id: string;
  readonly category: string;
  readonly event_kind: string;
  readonly input: string;
  readonly assertions: readonly string[];
}

const cases = readFileSync(
  resolve(
    import.meta.dirname,
    "../../test-fixtures/data/adversarial_cases.jsonl",
  ),
  "utf8",
)
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line) as AdversarialCase);

const engine = new LocalClinicalEngine(syntheticPack);
const input = (item: AdversarialCase): RuntimeInput => ({
  request_id: "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349",
  session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  sequence: 1,
  input_type: item.event_kind === "voice_partial" ? "voice_partial" : "typed",
  text: item.category === "asr_uncertain_product" ? "페니" : item.input,
  is_partial: item.event_kind === "voice_partial",
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  asr:
    item.event_kind === "voice_partial"
      ? {
          confidence: 0.4,
          alternatives: ["페니라민", "페니실린"],
          stable_prefix_chars: 2,
        }
      : null,
  client_timestamp: "2026-07-10T00:00:00Z",
});

describe("provided adversarial inventory", () => {
  it("keeps all 50 unique cases and declared assertions", () => {
    expect(cases).toHaveLength(50);
    expect(new Set(cases.map((item) => item.case_id)).size).toBe(50);
    expect(cases.every((item) => item.assertions.length > 0)).toBe(true);
  });

  it("replays every typed and voice case through the offline engine", () => {
    const replay = cases.filter(
      (item) =>
        item.event_kind === "typed" || item.event_kind === "voice_partial",
    );
    expect(replay).toHaveLength(20);
    for (const item of replay) {
      const started = performance.now();
      const result = engine.run(input(item));
      expect(performance.now() - started, item.case_id).toBeLessThan(100);
      expect(result.output.source_refs, item.case_id).toEqual([]);
      expect(result.output.say_now.join(" "), item.case_id).not.toMatch(
        /\b\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc|정|회)\b/iu,
      );
      expect(
        result.output.actions.some((action) =>
          /추천|판매|처방/u.test(action.text),
        ),
        item.case_id,
      ).toBe(false);
    }
  });

  it("preserves the high-risk semantic gates", () => {
    const byCategory = new Map(cases.map((item) => [item.category, item]));
    for (const category of [
      "negated_red_flag",
      "past_red_flag",
      "other_person",
    ]) {
      const item = byCategory.get(category);
      if (!item) throw new Error(`missing ${category}`);
      expect(engine.run(input(item)).output.mode, item.case_id).not.toBe(
        "escalate",
      );
    }
    for (const category of [
      "double_negation",
      "pediatric_missing_weight",
      "pediatric_product_ambiguous",
      "concentration_missing",
      "pill_missed_unknown_product",
      "pregnancy_unknown",
      "animal_domain",
      "supplement_treatment_claim",
      "pii_phone",
      "pii_rrn",
    ]) {
      const item = byCategory.get(category);
      if (!item) throw new Error(`missing ${category}`);
      expect(engine.run(input(item)).output.status, item.case_id).toBe(
        "blocked",
      );
    }
    const asr = byCategory.get("asr_uncertain_product");
    if (!asr) throw new Error("missing asr_uncertain_product");
    const asrResult = engine.run(input(asr));
    expect(asrResult.output.status).toBe("provisional");
    expect(asrResult.ruleIds).toContain("ASR_ALTERNATIVES");
  });
});
