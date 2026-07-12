import { describe, expect, it } from "vitest";
import {
  classifyEvidence,
  normalizeKorean,
  redactPii,
  shouldSearchDuringComposition,
} from "./index.js";

describe("Korean normalizer", () => {
  it("normalizes NFKC, spacing, units, age and weight", () => {
    const value = normalizeKorean("  아이　네살 １６킬로 몇 씨씨\r\n");
    expect(value.normalizedText).toContain("16kg");
    expect(value.normalizedText).toContain("mL");
    expect(value.slots["age_years"]?.value).toBe(4);
    expect(value.slots["weight_kg"]?.value).toBe(16);
  });

  it("masks phone/email/RRN and fails closed for high-risk PII", () => {
    const value = redactPii("010-1234-5678 a@b.co 주민번호 900101-1234567");
    expect(value.text).not.toContain("010-1234-5678");
    expect(value.text).not.toContain("900101-1234567");
    expect(value.safeForExternal).toBe(false);
  });

  it("preserves ASR alternatives without selecting one", () => {
    const value = normalizeKorean("페니", ["페니라민", "페니실린", "페니라민"]);
    expect(value.alternatives).toEqual(["페니라민", "페니실린"]);
  });

  it("respects IME composition", () => {
    expect(shouldSearchDuringComposition(true, "input")).toBe(false);
    expect(shouldSearchDuringComposition(true, "compositionend")).toBe(true);
  });

  it("distinguishes negated, past, other-person, and double-negative evidence", () => {
    expect(classifyEvidence("숨은 전혀 안 차요", /숨/u).state).toBe("negative");
    expect(classifyEvidence("숨이 안 찬 건 아니에요", /숨/u).state).toBe(
      "uncertain",
    );
    expect(
      classifyEvidence("작년에는 숨이 찼지만 지금은 괜찮아요", /숨/u)
        .temporality,
    ).toBe("past");
    expect(normalizeKorean("아버지가 가슴이 아프대요").personScope).toBe(
      "other",
    );
  });
});
