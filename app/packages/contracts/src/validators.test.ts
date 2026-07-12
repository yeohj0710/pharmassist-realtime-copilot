import { describe, expect, it } from "vitest";
import { validateContract } from "./validators.js";

describe("contract validators", () => {
  it("rejects unknown runtime input fields and malformed UUIDs", () => {
    const result = validateContract("runtimeInput", {
      request_id: "bad",
      session_id: "bad",
      sequence: 0,
      input_type: "typed",
      text: "기침",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: "2026-07-10T00:00:00Z",
      patient_name: "금지",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects free-text feedback properties", () => {
    const result = validateContract("feedback", {
      session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
      sequence: 1,
      card_id: "CARD-DEMO",
      outcome: "rejected",
      reason_codes: ["WRONG_INTENT"],
      knowledge_version: "0.1.0",
      latency_bucket: "100-250",
      transcript: "should fail",
    });
    expect(result.ok).toBe(false);
  });
});
