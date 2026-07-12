import { describe, expect, it } from "vitest";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  buildAiRefinementBody,
  shouldRequestAiRefinement,
} from "./ai-fallback.js";

describe("AI refinement routing", () => {
  it("uses AI on a normal turn even when the local engine already chose an intent", () => {
    expect(shouldRequestAiRefinement(true, "clarify")).toBe(true);
  });

  it("keeps emergency escalation local and immediate", () => {
    expect(shouldRequestAiRefinement(true, "escalate")).toBe(false);
  });

  it("sends recent turns so AI can recognize an answered duration question", () => {
    const body = buildAiRefinementBody(
      {} as RuntimeInput,
      { knowledge_version: "v" } as RuntimeOutput,
      ["기침이 나요", "어제부터요"],
    );
    expect(body.conversation_history).toEqual(["기침이 나요", "어제부터요"]);
  });
});
