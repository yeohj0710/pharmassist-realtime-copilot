import { describe, expect, it } from "vitest";
import { normalizeKorean } from "@pharmassist/normalizer";
import { serializeAudit } from "@pharmassist/observability";

describe("privacy boundary", () => {
  it("redacts identifiers and blocks external processing for high-risk PII", () => {
    const value = normalizeKorean(
      "전화 010-1234-5678 주민번호 900101-1234567 기침",
    );
    expect(value.safeForExternal).toBe(false);
    expect(value.redactedText).not.toContain("010-1234-5678");
    expect(value.redactedText).not.toContain("900101-1234567");
  });

  it("audit allowlist excludes arbitrary content", () => {
    const event = serializeAudit({
      event_name: "consult",
      timestamp: "2026-07-10T00:00:00Z",
      status_code: 200,
      sequence: 1,
    });
    expect(event).not.toContain("patient");
    expect(
      Object.keys(JSON.parse(event) as Record<string, unknown>).sort(),
    ).toEqual(["event_name", "sequence", "status_code", "timestamp"].sort());
    expect(() =>
      serializeAudit({
        event_name: "consult",
        timestamp: "x",
        patient_text: "canary",
      } as never),
    ).toThrow("OBSERVABILITY_FIELD_REJECTED");
  });
});
