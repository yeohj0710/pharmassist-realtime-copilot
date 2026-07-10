import { describe, expect, it } from "vitest";
import { shouldRequestAiRefinement } from "./ai-fallback.js";

describe("AI refinement routing", () => {
  it("uses AI on a normal turn even when the local engine already chose an intent", () => {
    expect(shouldRequestAiRefinement(true, "clarify")).toBe(true);
  });

  it("keeps emergency escalation local and immediate", () => {
    expect(shouldRequestAiRefinement(true, "escalate")).toBe(false);
  });
});
