import { describe, expect, it } from "vitest";
import { serializeAudit } from "./index.js";
describe("content-free audit", () => {
  it("allows coded metadata", () =>
    expect(
      serializeAudit({
        event_name: "instant",
        timestamp: "2026-07-10T00:00:00Z",
        card_id: "CARD-X",
      }),
    ).toContain("CARD-X"));
  it("rejects arbitrary raw fields", () =>
    expect(() =>
      serializeAudit({
        event_name: "x",
        timestamp: "x",
        raw_text: "canary",
      } as never),
    ).toThrow(/REJECTED/u));
});
