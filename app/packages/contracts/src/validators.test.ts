import { describe, expect, it } from "vitest";
import { validateContract } from "./validators.js";

const decision = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  decision_id: "DEC-TEST-1",
  status: "insufficient",
  pack_id: "PACK-TEST",
  protocol_id: null,
  intent: null,
  tenant_inventory_connected: false,
  ingredient_options: [],
  product_candidates: [],
  question: null,
  referral: null,
  source_refs: [],
  reason_codes: ["TEST"],
  ...overrides,
});

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

  it("enforces conditional RecommendationDecision invariants", () => {
    expect(
      validateContract("recommendationDecision", {
        ...decision({ status: "recommend" }),
      }).ok,
    ).toBe(false);
    expect(
      validateContract("recommendationDecision", {
        ...decision({
          status: "ask",
          question: {
            question: "언제부터인가요?",
            reason: "기간 확인",
            slot: "duration",
          },
        }),
      }).ok,
    ).toBe(true);
    expect(
      validateContract("recommendationDecision", {
        ...decision({
          status: "refer",
          referral: {
            urgency: "same_day",
            reason: "red flag",
            action: "진료를 받으세요.",
          },
          product_candidates: [{ product_id: "PRD-X" }],
        }),
      }).ok,
    ).toBe(false);
  });

  it("requires active pack scope on tenant inventory and sales rows", () => {
    expect(
      validateContract("tenantInventory", {
        inventory_id: "INV-TEST",
        tenant_id: "demo",
        product_id: "PRD-TEST",
        available_quantity: 1,
        status: "in_stock",
        active: true,
        discontinued: false,
        observed_at: "2026-07-13T00:00:00Z",
        source_snapshot_id: "SNAP-POS-TEST",
      }).ok,
    ).toBe(false);
    expect(
      validateContract("tenantInventory", {
        inventory_id: "INV-TEST",
        tenant_id: "demo",
        pack_id: "PACK-TEST",
        product_id: "PRD-TEST",
        available_quantity: 1,
        status: "in_stock",
        active: true,
        discontinued: false,
        observed_at: "2026-07-13T00:00:00Z",
        source_snapshot_id: "SNAP-POS-TEST",
      }).ok,
    ).toBe(true);
  });
});

describe("what counts as a source URI", () => {
  const snapshot = (source_url: string) => ({
    source_snapshot_id: "SNAP-URI-TEST",
    source_id: "SRC-URI-TEST",
    provider: "other" as const,
    official: false,
    source_url,
    fetched_at: "2026-07-31T00:00:00+09:00",
    usage_rights: "unknown" as const,
    commercial_use: "unknown" as const,
    cache_policy: "unknown" as const,
    redistribution: "unknown" as const,
    ai_context_use: "unknown" as const,
    http_status: 200,
    content_sha256: "a".repeat(64),
    content_type: "text/plain",
    parser_version: "test-v1",
    record_count: 1,
    status: "parsed" as const,
    raw_retention_policy: "none" as const,
    uncertainty: "test",
  });

  it("still refuses a web source with no host to name", () => {
    // A half-written URL must never be recorded as where material came from.
    expect(validateContract("sourceSnapshot", snapshot("https://")).ok).toBe(
      false,
    );
    expect(validateContract("sourceSnapshot", snapshot("not a url")).ok).toBe(
      false,
    );
    expect(
      validateContract("sourceSnapshot", snapshot("https://example.org/a.pdf"))
        .ok,
    ).toBe(true);
  });

  it("accepts the identifier a printed source actually has", () => {
    // A book has an ISBN and no host. urn:isbn:… is a URI; demanding a
    // hostname of it rejected the only identifier the book has.
    expect(
      validateContract("sourceSnapshot", snapshot("urn:isbn:9791199593046")).ok,
    ).toBe(true);
  });
});
