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

  it("preserves an explicit pregnancy negation", () => {
    const value = normalizeKorean("35살이고 임신은 아니에요");
    expect(value.slots["pregnancy_status"]?.value).toBe("not_pregnant");
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

  it.each([
    ["어깨가 결려요", "어깨"],
    ["무릎이 아파요", "무릎"],
    ["허리가 뻐근해요", "허리"],
    ["손목이 시큰해요", "손목"],
    ["발목을 삐었어요", "발목"],
    ["팔꿈치가 아파요", "팔꿈치"],
    ["고관절이 불편해요", "고관절"],
    ["목이 뻐근해요", "목"],
    ["팔이 아파요", "팔"],
    ["다리가 아파요", "다리"],
  ])("extracts a canonical body site: %s", (input, expected) => {
    expect(normalizeKorean(input).slots["body_site"]?.value).toBe(expected);
  });

  it.each([
    ["배아프노", "배가 아파요"],
    ["배가 아픈데", "배가 아파요"],
    ["속쓰리네", "속이 쓰려요"],
    ["소화 안된다", "소화 안 돼요"],
    ["머리아프다", "머리가 아파요"],
    ["기침나네", "기침나요"],
    ["똥마려워요", "변이 마려워요"],
    ["똥이 마려운 배아픔", "변이 마려워요 배아픔"],
    ["대변이 마려운데", "변이 마려워요"],
    ["화장실이 급해요", "변이 마려워요"],
  ])("normalizes colloquial symptom wording: %s", (input, expected) => {
    expect(normalizeKorean(input).normalizedText).toContain(expected);
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
