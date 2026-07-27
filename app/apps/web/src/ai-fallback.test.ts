import { describe, expect, it } from "vitest";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { customerTurn } from "@pharmassist/dialogue";
import {
  answeredSlotFromInterpretation,
  buildAiRefinementBody,
  interpretedIntent,
  pendingCounselorQuestion,
  shouldBypassAiInterpretation,
  shouldInterpretWithAi,
  shouldRequestAiRefinement,
  type AiConversationInterpretation,
} from "./ai-fallback.js";

const openQuestion = {
  question: "언제부터 그러셨나요?",
  slot: "symptom.duration",
};
const interpretation = (
  overrides: Partial<AiConversationInterpretation> = {},
): AiConversationInterpretation => ({
  disposition: "answer_or_detail",
  intent: null,
  confidence: 0.9,
  topicChanged: false,
  answersPendingQuestion: true,
  ...overrides,
});

describe("AI refinement routing", () => {
  it("uses AI on a normal turn even when the local engine already chose an intent", () => {
    expect(shouldRequestAiRefinement(true, "instant", "recommend")).toBe(true);
  });

  it("keeps emergency escalation local and immediate", () => {
    expect(shouldRequestAiRefinement(true, "escalate", "refer")).toBe(false);
  });

  it("keeps questions local instead of sending them through product narration", () => {
    expect(shouldRequestAiRefinement(true, "clarify", "ask")).toBe(false);
  });

  it("bypasses the network for explicit red flags", () => {
    expect(shouldBypassAiInterpretation("숨쉬기 너무 힘들어요")).toBe(true);
    expect(shouldBypassAiInterpretation("가슴이 짓눌리고 식은땀이 나요")).toBe(
      true,
    );
    expect(shouldBypassAiInterpretation("기침 때문에 밤에 좀 깼어요")).toBe(
      false,
    );
  });

  it("interprets contextual answers and possible topic changes while a question is open", () => {
    expect(shouldInterpretWithAi(true, true, "따갑고 아픈 정도예요")).toBe(
      true,
    );
    expect(shouldInterpretWithAi(true, true, "처음 하는 새로운 문의")).toBe(
      true,
    );
  });

  it("sends recent turns so AI can recognize an answered duration question", () => {
    const body = buildAiRefinementBody(
      {} as RuntimeInput,
      { knowledge_version: "v" } as RuntimeOutput,
      [customerTurn("기침이 나요", 1), customerTurn("어제부터요", 2)],
    );
    expect(body.conversation_history).toEqual([
      "손님: 기침이 나요",
      "손님: 어제부터요",
    ]);
  });
});

describe("answers to an open counselor question", () => {
  it("takes the open question from the previous turn", () => {
    expect(
      pendingCounselorQuestion({
        ask_next: [{ ...openQuestion, reason: "증상 기간 확인", priority: 1 }],
      } as unknown as RuntimeOutput),
    ).toEqual(openQuestion);
    expect(
      pendingCounselorQuestion({ ask_next: [] } as unknown as RuntimeOutput),
    ).toBeUndefined();
    expect(pendingCounselorQuestion(undefined)).toBeUndefined();
  });

  it("fills the slot the counselor asked about, never one the model picks", () => {
    expect(answeredSlotFromInterpretation(interpretation(), openQuestion)).toBe(
      "symptom.duration",
    );
  });

  it("ignores a claimed answer when nothing was asked", () => {
    expect(
      answeredSlotFromInterpretation(interpretation(), undefined),
    ).toBeUndefined();
  });

  it("leaves the question open on a topic change or a low-confidence read", () => {
    expect(
      answeredSlotFromInterpretation(
        interpretation({ topicChanged: true }),
        openQuestion,
      ),
    ).toBeUndefined();
    expect(
      answeredSlotFromInterpretation(
        interpretation({ confidence: 0.3 }),
        openQuestion,
      ),
    ).toBeUndefined();
    expect(
      answeredSlotFromInterpretation(
        interpretation({ answersPendingQuestion: false }),
        openQuestion,
      ),
    ).toBeUndefined();
  });

  it("keeps a new clinical intent separate from the answered slot", () => {
    expect(
      interpretedIntent(
        interpretation({
          disposition: "clinical_intent",
          intent: "cough_general",
        }),
      ),
    ).toBe("cough_general");
    expect(interpretedIntent(interpretation())).toBeUndefined();
  });
});
