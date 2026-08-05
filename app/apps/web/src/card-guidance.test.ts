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
const productById = new Map(
  actualPack.products.map((product) => [product.product_id, product]),
);

const consult = (turns: readonly string[]) => {
  const engine = new LocalClinicalEngine(actualPack);
  const sessionId = crypto.randomUUID();
  let state: ConsultationState | undefined;
  let last: ReturnType<typeof engine.run> | undefined;
  turns.forEach((text, index) => {
    last = engine.run(
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
    state = last.consultationState;
  });
  return last;
};

// Options and cards are made by different layers: a curated claim creates the
// option, the pathway mapping creates the card. Where they disagreed a product
// reached the counter with nothing written on it — 게보린브이정 was the second
// joint-pain candidate and 아이투오미니점안액 the first for dry eye, both
// blank. A card with no "when to use" is worse than a missing candidate,
// because the pharmacist has no way to tell why it is on the list.
const PRESENTATIONS = [
  "열이 나요",
  "머리가 아파요",
  "목이 아파요",
  "콧물이 계속 나요",
  "코가 막혀요",
  "기침하고 가래가 껴요",
  "마른기침이 나요",
  "소화가 안 되고 더부룩해요",
  "속이 쓰려요",
  "배에 가스가 차요",
  "설사를 해요",
  "변비가 있어요",
  "생리통이 심해요",
  "무릎이 아파요",
  "허리가 아파요",
  "눈이 뻑뻑해요",
  "벌레에 물렸어요",
  "상처가 났어요",
  "화상을 입었어요",
  "멀미를 해요",
  "입안이 헐었어요",
  "여드름이 났어요",
  "비듬이 많아요",
  "잠이 안 와요",
  "잇몸이 부었어요",
  "치질이 있어요",
  "멍이 들었어요",
  "두드러기가 났어요",
  "피부가 가렵고 붉어요",
];

describe("a displayed candidate always says why it is there", () => {
  it.each(PRESENTATIONS)("%s", (presentation) => {
    // A first turn only asks; the answer is what reaches a recommendation.
    const result = consult([presentation, "어제부터요"]);
    const decision = result?.output.decision;
    const blank = (decision?.product_candidates ?? []).filter((candidate) => {
      const product = productById.get(candidate.product_id);
      const profile = (product?.selection_profiles ?? []).find(
        (item) => item.protocol_id === decision?.protocol_id,
      );
      return !profile?.choose_when?.trim() || !profile?.comparison_note?.trim();
    });
    expect(
      blank.map((candidate) => candidate.display_name),
      `${presentation} -> ${decision?.protocol_id}`,
    ).toEqual([]);
  });
});
