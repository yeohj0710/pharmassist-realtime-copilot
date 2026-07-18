import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ConsultationState,
  RuntimeInput,
  TenantInventory,
} from "@pharmassist/contracts";
import {
  syntheticFormulary,
  syntheticInventory,
  syntheticPack,
  syntheticSales,
} from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { LocalClinicalEngine } from "./index.js";

const engine = new LocalClinicalEngine(syntheticPack);
const uuidA = "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349";
const uuidB = "c5beed71-acde-4a33-8c5a-a33ffdd81f6d";
const makeInput = (
  text: string,
  inputType: RuntimeInput["input_type"] = "typed",
  domain: RuntimeInput["domain"] = "human_otc",
  sequence = 1,
): RuntimeInput => ({
  request_id: uuidA,
  session_id: uuidB,
  sequence,
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
  client_timestamp: "2026-07-13T00:00:00Z",
});

const tenantContext = (state?: ConsultationState) => ({
  tenantId: "demo",
  formulary: syntheticFormulary,
  inventory: syntheticInventory,
  sales: syntheticSales,
  ...(state ? { consultationState: state } : {}),
});

interface SafetyGoldenCase {
  readonly case_id: string;
  readonly input: {
    readonly input_type: RuntimeInput["input_type"];
    readonly text: string;
    readonly domain: RuntimeInput["domain"];
  };
  readonly expected: {
    readonly mode: string;
    readonly must_trigger_rule: string;
  };
}

interface DecisionGoldenCase {
  readonly case_id: string;
  readonly topic: string;
  readonly turns: readonly Readonly<{
    text: string;
    status: "recommend" | "ask" | "refer" | "insufficient";
    slot?: string;
  }>[];
}

const safetyCases = readFileSync(
  resolve(import.meta.dirname, "../../test-fixtures/data/golden_cases.jsonl"),
  "utf8",
)
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line) as SafetyGoldenCase);

const decisionCases = readFileSync(
  resolve(
    import.meta.dirname,
    "../../test-fixtures/data/decision_golden_cases.jsonl",
  ),
  "utf8",
)
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line) as DecisionGoldenCase);

const deferredEnding =
  /(?:제시|안내|알려|추천|골라|확인).{0,12}(?:드릴게요|할게요|하겠습니다)[.!]?$/u;

describe("deterministic local runtime", () => {
  it("preserves all 50 safety golden gates without a network dependency", () => {
    expect(safetyCases).toHaveLength(50);
    for (const item of safetyCases) {
      const result = engine.run(
        makeInput(item.input.text, item.input.input_type, item.input.domain),
      );
      expect(result.output.mode, item.case_id).toBe(item.expected.mode);
      expect(result.ruleIds, item.case_id).toContain(
        item.expected.must_trigger_rule,
      );
      expect(result.output.ask_next.length, item.case_id).toBeLessThanOrEqual(
        1,
      );
      if (result.output.decision.status === "recommend") {
        expect(
          result.output.decision.ingredient_options.length,
          item.case_id,
        ).toBeGreaterThan(0);
        expect(result.output.source_refs.length, item.case_id).toBeGreaterThan(
          0,
        );
      }
      if (result.output.decision.status === "refer")
        expect(result.output.decision.product_candidates, item.case_id).toEqual(
          [],
        );
      expect(result.output.say_now.join(" "), item.case_id).not.toMatch(
        /\b\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc|정|회|일)\b/iu,
      );
      expect(result.output.say_now.join(" "), item.case_id).not.toMatch(
        deferredEnding,
      );
    }
  });

  it("covers the required OTC topics and emits only active-pack entities", () => {
    expect(decisionCases.map((item) => item.topic)).toEqual([
      "기침",
      "콧물",
      "인후통",
      "속쓰림",
      "소화불량",
      "설사",
      "변비",
      "근육통",
      "피부 증상",
      "발열",
    ]);
    const ingredientIds = new Set(
      syntheticPack.ingredients.map((item) => item.ingredient_id),
    );
    const productIds = new Set(
      syntheticPack.products.map((item) => item.product_id),
    );
    const claimIds = new Set(syntheticPack.claims.map((item) => item.claim_id));
    const snapshotIds = new Set(
      syntheticPack.sources.map((item) => item.source_snapshot_id),
    );

    for (const item of decisionCases) {
      let state: ConsultationState | undefined;
      for (const [index, turn] of item.turns.entries()) {
        const result = engine.run(
          makeInput(turn.text, "typed", "human_otc", index + 1),
          tenantContext(state),
        );
        state = result.consultationState;
        const decision = result.output.decision;
        expect(decision.status, `${item.case_id}:${index + 1}`).toBe(
          turn.status,
        );
        expect(result.output.ask_next.length).toBeLessThanOrEqual(1);
        if (turn.slot) expect(result.output.ask_next[0]?.slot).toBe(turn.slot);
        if (decision.status !== "recommend") continue;
        expect(decision.pack_id).toBe(syntheticPack.packId);
        expect(decision.ingredient_options.length).toBeGreaterThan(0);
        expect(decision.product_candidates.length).toBeGreaterThan(0);
        expect(decision.source_refs.length).toBeGreaterThan(0);
        for (const option of decision.ingredient_options) {
          expect(ingredientIds.has(option.ingredient_id)).toBe(true);
          expect(option.claim_ids.every((id) => claimIds.has(id))).toBe(true);
        }
        for (const product of decision.product_candidates) {
          expect(productIds.has(product.product_id)).toBe(true);
          expect(product.available_quantity).toBeGreaterThan(0);
          expect(product.inventory_status).toBe("in_stock");
        }
        expect(
          decision.source_refs.every((ref) =>
            snapshotIds.has(ref.source_snapshot_id),
          ),
        ).toBe(true);
        expect(result.output.say_now.join(" ")).not.toMatch(deferredEnding);
      }
    }
  });

  it("switches to an easier question after an uncertain answer", () => {
    const first = engine.run(makeInput("기침이 나요"), tenantContext());
    expect(first.output.decision.status).toBe("ask");
    expect(first.output.ask_next[0]?.slot).toBe("duration");
    const second = engine.run(
      makeInput("모르겠어요", "typed", "human_otc", 2),
      tenantContext(first.consultationState),
    );
    expect(second.output.decision.status).toBe("ask");
    expect(second.output.ask_next[0]?.slot).toBe("patient.detail");
    expect(second.output.ask_next[0]?.question).toContain(
      "평소 말씀하시는 표현",
    );
    expect(second.output.decision.reason_codes).toContain(
      "UNCERTAIN_ANSWER_ALTERNATIVE_ASK",
    );
  });

  it("filters zero-stock, inactive, and discontinued products", () => {
    const unavailable: readonly TenantInventory[] = syntheticInventory.map(
      (item) => ({
        ...item,
        available_quantity: 0,
        status: "out_of_stock" as const,
        active: false,
        discontinued: true,
      }),
    );
    const result = engine.run(makeInput("속이 쓰려요"), {
      ...tenantContext(),
      inventory: unavailable,
    });
    expect(result.output.decision.status).toBe("insufficient");
    expect(result.output.decision.product_candidates).toEqual([]);
    expect(result.output.decision.reason_codes).toContain(
      "NO_IN_STOCK_FORMULARY_PRODUCT",
    );
  });

  it("never attaches a product to a red-flag referral", () => {
    const result = engine.run(
      makeInput("숨쉬기 너무 힘들고 기침해요"),
      tenantContext(),
    );
    expect(result.output.decision.status).toBe("refer");
    expect(result.output.decision.ingredient_options).toEqual([]);
    expect(result.output.decision.product_candidates).toEqual([]);
  });

  it("fails closed when production loads synthetic knowledge", () => {
    expect(() => new LocalClinicalEngine(syntheticPack, "production")).toThrow(
      /PACK_SYNTHETIC|activation blocked/u,
    );
  });
});
