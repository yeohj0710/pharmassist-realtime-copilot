// The production worker replays each turn twice: an immediate run, then a
// revision of the same sequence carrying what the AI interpreter concluded.
// These tests drive StatefulConsultFlow exactly that way for the 2026-07-30
// screenshot session (배아파요 → 속이안좋아요), across the interpreter
// outcomes the live endpoint actually returns for that wording.
import { describe, expect, it } from "vitest";
import type { RuntimeInput } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import type { RuntimePack } from "@pharmassist/runtime";
import actualPackJson from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import { StatefulConsultFlow } from "./consult-flow.js";
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const validated = validateContract<RuntimePack>("runtimePack", actualPackJson);
if (!validated.ok || !validated.value)
  throw new Error(JSON.stringify(validated.errors));
const actualPack = validated.value;
const previewFormulary = buildResearchPreviewFormulary(actualPack);

const makeInput = (
  sessionId: string,
  sequence: number,
  text: string,
  extras: Readonly<{ intent?: string; answeredSlot?: string }> = {},
): RuntimeInput =>
  ({
    request_id: crypto.randomUUID(),
    session_id: sessionId,
    sequence,
    input_type: "typed",
    text,
    ...(extras.intent ? { intent_hint: extras.intent } : {}),
    ...(extras.answeredSlot
      ? { answers_pending_slot: extras.answeredSlot }
      : {}),
    is_partial: false,
    locale: "ko-KR",
    domain: "human_otc",
    patient_context: {},
    client_timestamp: new Date().toISOString(),
  }) as RuntimeInput;

/** Runs 배아파요 as turn 1 (immediate + hinted revision), then turn 2. */
const secondTurn = (
  extras: Readonly<{ intent?: string; answeredSlot?: string }>,
) => {
  const flow = new StatefulConsultFlow(actualPack, {
    tenantId: "local-research-preview",
    formulary: previewFormulary,
  });
  const session = crypto.randomUUID();
  flow.run(makeInput(session, 1, "배아파요"));
  flow.run(
    makeInput(session, 1, "배아파요", { intent: "abdominal_pain_unknown" }),
  );
  flow.run(makeInput(session, 2, "속이안좋아요"));
  return flow.run(makeInput(session, 2, "속이안좋아요", extras));
};

describe("AI hint replays of the same turn", () => {
  it("routes a dyspepsia hint into the indigestion protocol", () => {
    // 속이안좋아요 lexically matches no dyspepsia wording, so only the
    // hinted-protocol bridge can act on the model's classification. Before
    // the bridge, the hint tore down the abdominal topic without activating
    // anything and the consultation drifted into 근거 부족.
    const result = secondTurn({ intent: "dyspepsia_general" });

    expect(result.output.decision.protocol_id).toBe("PTC-INDIGESTION");
    expect(result.output.decision.status).toBe("recommend");
    expect(result.output.decision.product_candidates.length).toBeGreaterThan(0);
  });

  it("keeps an answer on the open question instead of switching topics", () => {
    // The interpreter may flag the same vague reply as answering the menu.
    // An answer never switches protocol; the menu retries within budget.
    const result = secondTurn({
      intent: "dyspepsia_general",
      answeredSlot: "symptom.phenotype",
    });

    expect(result.output.decision.protocol_id).toBe(
      "PTC-ABDOMINAL_PAIN_VOMITING",
    );
    expect(result.output.ask_next[0]?.slot).toBe("symptom.phenotype");
  });

  it("retries the menu when the hint stays on the same protocol", () => {
    const result = secondTurn({ intent: "nausea_vomiting_adult" });

    expect(result.output.decision.protocol_id).toBe(
      "PTC-ABDOMINAL_PAIN_VOMITING",
    );
    expect(result.output.ask_next[0]?.slot).toBe("symptom.phenotype");
  });

  it("never ends a two-turn consultation without a question or candidates", () => {
    const variants: readonly Readonly<{
      intent?: string;
      answeredSlot?: string;
    }>[] = [
      {},
      { answeredSlot: "symptom.phenotype" },
      { intent: "dyspepsia_general" },
      { intent: "dyspepsia_general", answeredSlot: "symptom.phenotype" },
      { intent: "heartburn_reflux_symptom" },
      { intent: "nausea_vomiting_adult" },
      { intent: "abdominal_pain_unknown" },
    ];
    for (const extras of variants) {
      const result = secondTurn(extras);
      const moved =
        result.output.ask_next.length > 0 ||
        result.output.decision.product_candidates.length > 0;
      expect(moved, JSON.stringify(extras)).toBe(true);
    }
  });
});
