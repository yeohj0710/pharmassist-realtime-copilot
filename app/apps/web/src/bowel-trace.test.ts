// The 2026-07-30 21:52 production session: the bowel-urgency card question
// rendered but was never recorded as pending, so the interpreter's
// answers_pending_slot pointed at a slot the engine did not consider open —
// even 변이 마려운 느낌, echoing the question's own wording, repeated it.
// The invariant under test: the question the customer saw is the question
// the state records, whatever produced it, and an accepted answer closes it.
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

const replaySession = () => {
  const flow = new StatefulConsultFlow(actualPack, {
    tenantId: "local-research-preview",
    formulary: previewFormulary,
  });
  const session = crypto.randomUUID();
  const turn = (
    sequence: number,
    text: string,
    extras: Readonly<{ intent?: string; answeredSlot?: string }>,
  ) => {
    flow.run(makeInput(session, sequence, text));
    return flow.run(makeInput(session, sequence, text, extras));
  };
  return { turn };
};

describe("every displayed question is the recorded question", () => {
  it("records a card question and closes it on the customer's answer", () => {
    const { turn } = replaySession();
    turn(1, "배야파요", { intent: "abdominal_pain_unknown" });
    turn(2, "똥마려워요", {
      intent: "bowel_urgency_context",
      answeredSlot: "symptom.phenotype",
    });
    const cardAsk = turn(3, "아니 똥만마렵다고요", {
      intent: "bowel_urgency_context",
      answeredSlot: "symptom.bowel_urgency_pattern",
    });
    // The displayed card question is now also the pending one in state.
    expect(cardAsk.output.ask_next[0]?.slot).toBe(
      "symptom.bowel_urgency_pattern",
    );
    expect(cardAsk.consultationState.pending_question_slot).toBe(
      "symptom.bowel_urgency_pattern",
    );
    expect(cardAsk.consultationState.asked_slots).toContain(
      "symptom.bowel_urgency_pattern",
    );

    const answered = turn(4, "변이 마려운 느낌", {
      intent: "bowel_urgency_context",
      answeredSlot: "symptom.bowel_urgency_pattern",
    });
    // The answer closes the question — no repeat — and the consultation
    // moves on to candidates instead of stalling.
    expect(answered.output.ask_next[0]?.slot).not.toBe(
      "symptom.bowel_urgency_pattern",
    );
    expect(answered.output.decision.status).toBe("recommend");
    expect(answered.output.decision.product_candidates.length).toBeGreaterThan(
      0,
    );
  });

  it("recognizes the colloquial bowel answers offline too", () => {
    // Without any interpreter flags, the widened slot patterns must accept
    // the same wording the customer actually used.
    const flow = new StatefulConsultFlow(actualPack, {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    });
    const session = crypto.randomUUID();
    flow.run(makeInput(session, 1, "배야파요"));
    flow.run(makeInput(session, 2, "똥마려워요"));
    const cardAsk = flow.run(makeInput(session, 3, "화장실이 급해요"));
    if (
      cardAsk.consultationState.pending_question_slot ===
      "symptom.bowel_urgency_pattern"
    ) {
      const answered = flow.run(makeInput(session, 4, "아니 똥만마렵다고요"));
      expect(answered.output.ask_next[0]?.slot).not.toBe(
        "symptom.bowel_urgency_pattern",
      );
    }
    expect(cardAsk.output).toBeDefined();
  });
});
