import { describe, expect, it } from "vitest";
import type { ConsultationState } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import type { RuntimePack } from "@pharmassist/runtime";
import { LocalClinicalEngine } from "@pharmassist/runtime";
import actualPackJson from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const validated = validateContract<RuntimePack>("runtimePack", actualPackJson);
if (!validated.ok || !validated.value)
  throw new Error(JSON.stringify(validated.errors));
const actualPack = validated.value;
const previewFormulary = buildResearchPreviewFormulary(actualPack);

// What makes two rows the same real box: the audited crosswalk key first, then
// the registry row itself. Rows the audit has not linked keep their own
// identity on purpose, so a pack with two unlinked records for one product is
// allowed to show both.
const identityByProductId = new Map(
  actualPack.products.map((product) => [
    product.product_id,
    product.official_product_key ?? product.item_seq ?? product.product_id,
  ]),
);
const identityOf = (productId: string) =>
  identityByProductId.get(productId) ?? productId;

const consult = (turns: readonly string[]) => {
  const engine = new LocalClinicalEngine(actualPack);
  const sessionId = crypto.randomUUID();
  let state: ConsultationState | undefined;
  return turns.map((text, index) => {
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: sessionId,
        sequence: index + 1,
        input_type: "typed",
        text,
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
        ...(state ? { consultationState: state } : {}),
      },
    );
    state = result.consultationState;
    return result;
  });
};

describe("one box never takes two of five slots", () => {
  // The ranker already collapses one clinical group to a single row, which
  // hides most of this. It does not catch the pair whose two registry rows
  // carry different ingredient ids for the same substances — 보나링츄어블 and
  // 훼스탈플러스 each reach the pack that way — so those would still be able
  // to show the same box twice. A first turn only asks; the answer is what
  // reaches a recommendation, which is why every case here has two.
  it.each([
    "열이 나고 몸살기가 있어요",
    "소화가 안 되고 더부룩해요",
    "배에 가스가 차요",
    "콧물이 계속 나요",
    "기침하고 가래가 껴요",
    "목이 아파요",
    "머리가 아파요",
    "설사를 해요",
    "멀미를 해요",
    "여드름이 났어요",
    "비듬이 많아요",
    "눈이 뻑뻑해요",
  ])("shows distinct products for %s", (text) => {
    const [, answered] = consult([text, "어제부터요"]);
    const shown = [
      ...(answered?.output.decision.product_candidates ?? []),
      ...(answered?.output.provisional_candidates ?? []),
    ];
    // An empty list would satisfy every assertion below without proving
    // anything, so the case has to reach products first.
    expect(shown.length, text).toBeGreaterThan(0);
    const identities = shown.map((candidate) =>
      identityOf(candidate.product_id),
    );
    expect(identities.length, text).toBe(new Set(identities).size);
    // The same thing said plainly: no repeated name on the card either.
    const names = shown.map((candidate) => candidate.display_name);
    expect(names.length, text).toBe(new Set(names).size);
  });
});

describe("the pack still carries every registry row", () => {
  // Deduplication happens where candidates are displayed, never by deleting a
  // record. Both rows stay in the pack because both are real registry rows.
  it("keeps both records of a duplicated registry row", () => {
    const groups = new Map<string, string[]>();
    for (const product of actualPack.products) {
      const identity = product.official_product_key ?? product.item_seq;
      if (!identity) continue;
      groups.set(identity, [
        ...(groups.get(identity) ?? []),
        product.product_id,
      ]);
    }
    const duplicated = [...groups.values()].filter((ids) => ids.length > 1);
    expect(duplicated.length).toBeGreaterThan(0);
  });
});
