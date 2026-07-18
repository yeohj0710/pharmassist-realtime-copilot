import { describe, expect, it } from "vitest";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { customerTurn } from "@pharmassist/dialogue";
import {
  buildAiRefinementBody,
  shouldBypassAiInterpretation,
  shouldInterpretWithAi,
  shouldRequestAiRefinement,
} from "./ai-fallback.js";

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
