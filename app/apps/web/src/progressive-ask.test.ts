import { describe, expect, it } from "vitest";
import type { RuntimeInput } from "@pharmassist/contracts";
import { LocalClinicalEngine, type RuntimePack } from "@pharmassist/runtime";
import actualPack from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const runtimePack = actualPack as unknown as RuntimePack;
const previewFormulary = buildResearchPreviewFormulary(runtimePack);

const run = (text: string) => {
  const engine = new LocalClinicalEngine(runtimePack);
  const input: RuntimeInput = {
    request_id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    sequence: 1,
    input_type: "typed",
    text,
    is_partial: false,
    locale: "ko-KR",
    domain: "human_otc",
    patient_context: {},
    client_timestamp: new Date().toISOString(),
  };
  return engine.run(input, {
    tenantId: "local-research-preview",
    formulary: previewFormulary,
  }).output;
};

const progressiveRules = actualPack.protocolRules.filter(
  (rule) =>
    rule.effect === "ask" && (rule as { progressive?: boolean }).progressive,
);

describe("progressive situation questions", () => {
  it("ships a situation question for every protocol that carries one", () => {
    expect(progressiveRules.length).toBe(32);
    for (const rule of progressiveRules) {
      // Referral rules sit at 100 and an unmatched ask short-circuits the
      // decision, so anything at or below that replaces a referral.
      expect(rule.priority, rule.rule_id).toBeGreaterThan(100);
      expect((rule.option_ids ?? []).length, rule.rule_id).toBeGreaterThan(1);
      expect(new Set(rule.option_ids ?? []).size, rule.rule_id).toBe(
        (rule.option_ids ?? []).length,
      );
    }
  });

  it("offers its branches to the counselor without asking them itself", () => {
    const output = run("코가 막혀요");
    expect(output.decision.protocol_id).toBe("PTC-NASAL_CONGESTION");
    // Does not block: candidates are shown while the question stands.
    expect(output.decision.status).toBe("recommend");
    expect(output.decision.product_candidates.length).toBeGreaterThan(1);
    // The counselor decides whether to ask, so the engine leaves ask_next to
    // the real questions and hands the branches over as fact targets.
    const targets = output.fact_targets ?? [];
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]?.options.length).toBeGreaterThan(1);
    expect(output.ask_next.some((item) => item.slot === targets[0]?.slot)).toBe(
      false,
    );
  });

  it("still refers a red flag instead of asking its situation question", () => {
    for (const text of [
      "치질인데 출혈이 많아요",
      "넓은 화상을 입었어요",
      "전조 편두통이 있는데 피임약 주세요",
      "열린 상처에 흉터약 주세요",
    ]) {
      const output = run(text);
      expect(["refer", "escalate"], text).toContain(
        output.mode === "escalate" ? "escalate" : output.decision.status,
      );
      expect(output.decision.product_candidates, text).toEqual([]);
      expect(output.provisional_candidates ?? [], text).toEqual([]);
    }
  });
});
