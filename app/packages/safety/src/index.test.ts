import { describe, expect, it } from "vitest";
import { normalizeKorean } from "@pharmassist/normalizer";
import { containsUnsupportedClinicalNumber, evaluateSafety } from "./index.js";

describe("ordered safety gates", () => {
  it("preempts retrieval for critical partial breathing input", () => {
    const result = evaluateSafety(
      normalizeKorean("입술 붓고 숨이 안 쉬어져요"),
      "human_otc",
    );
    expect(result.mode).toBe("escalate");
    expect(result.lockCritical).toBe(true);
  });

  it("does not escalate a negated or historical breathing phrase", () => {
    expect(
      evaluateSafety(normalizeKorean("숨은 안 차고 콧물만 있어요"), "human_otc")
        .mode,
    ).not.toBe("escalate");
    expect(
      evaluateSafety(
        normalizeKorean("작년에는 숨이 찼지만 지금은 괜찮아요"),
        "human_otc",
      ).mode,
    ).not.toBe("escalate");
  });

  it("scopes negation, temporality and person to the matched clause", () => {
    expect(
      evaluateSafety(
        normalizeKorean("호흡곤란은 없지만 갑자기 심한 흉통이 있어요"),
        "human_otc",
      ).ruleIds,
    ).toContain("RF-CHEST");
    expect(
      evaluateSafety(
        normalizeKorean("작년에 기침했지만 지금 숨이 안 쉬어져요"),
        "human_otc",
      ).ruleIds,
    ).toContain("RF-BREATHING");
    expect(
      evaluateSafety(
        normalizeKorean("아버지는 가슴이 아프지만 저는 숨이 안 쉬어져요"),
        "human_otc",
      ).ruleIds,
    ).toContain("RF-BREATHING");
  });

  it("stops a generic cough recommendation when current chest pain is present", () => {
    const result = evaluateSafety(
      normalizeKorean("기침나요 흉통이 있어요"),
      "human_otc",
    );
    expect(result.mode).toBe("escalate");
    expect(result.ruleIds).toContain("RF-CHEST-PAIN");
    expect(
      evaluateSafety(
        normalizeKorean("기침은 나지만 흉통은 없어요"),
        "human_otc",
      ).mode,
    ).not.toBe("escalate");
  });

  it("selects the most urgent concurrent red flag", () => {
    const decision = evaluateSafety(
      normalizeKorean("검은 변을 봤고 약을 너무 많이 먹었어요"),
      "human_otc",
    );
    expect(decision.redFlags[0]?.flag_id).toBe("RF-OVERDOSE");
    expect(decision.redFlags[0]?.action).toBe("emergency");
    expect(decision.ruleIds).toContain("RF-GI-BLEED");
  });

  it("evaluates repeated red flags and concept-scoped negation", () => {
    expect(
      evaluateSafety(
        normalizeKorean(
          "작년에는 갑자기 심한 흉통이 있었지만 지금 갑자기 심한 흉통이 있어요",
        ),
        "human_otc",
      ).ruleIds,
    ).toContain("RF-CHEST");
    for (const text of [
      "갑자기 심한 흉통은 없어요",
      "검은 변은 아니에요",
      "약을 너무 많이 먹은 건 아니에요",
    ])
      expect(
        evaluateSafety(normalizeKorean(text), "human_otc").mode,
        text,
      ).not.toBe("escalate");
  });

  it("blocks pediatric numeric output without verified product fields", () => {
    const result = evaluateSafety(
      normalizeKorean("4살 16kg 해열제 몇 mL"),
      "human_otc",
    );
    expect(result.mode).toBe("clarify");
    expect(result.missingSlots).toContain("product_concentration");
  });

  it("detects unsupported clinical numbers", () => {
    expect(containsUnsupportedClinicalNumber("500 mg 복용", [])).toBe(true);
    expect(containsUnsupportedClinicalNumber("119에 연락", [])).toBe(false);
  });

  it("accepts explicit pregnancy and allergy negation", () => {
    expect(
      evaluateSafety(
        normalizeKorean("임신 아니고 특이사항 없어요"),
        "human_otc",
      ).ruleIds,
    ).not.toContain("PREGNANCY_GATE");
    expect(
      evaluateSafety(normalizeKorean("알레르기 없음"), "human_otc").ruleIds,
    ).not.toContain("ALLERGY_GATE");
  });

  it("does not treat allergic rhinitis symptom text as allergy history", () => {
    expect(
      evaluateSafety(normalizeKorean("알레르기 비염"), "human_otc").ruleIds,
    ).not.toContain("ALLERGY_GATE");
  });
});
