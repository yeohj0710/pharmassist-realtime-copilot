import { describe, expect, it } from "vitest";
import {
  canonicalIngredientId,
  classifyOfficialProduct,
  parseClinicalPathwayDataset,
} from "./clinical-pathway-classifier.js";

const dataset = parseClinicalPathwayDataset({
  schemaVersion: "1.0.0",
  researchOnly: true,
  mechanismEvidence: {
    adsorbent: ["디오스멕타이트"],
    antimicrobial: ["니푸록사지드"],
  },
  pathways: [
    {
      pathwayId: "heartburn",
      protocolId: "PTC-HEARTBURN",
      efficacyAny: ["속쓰림", "위산과다"],
      routeFormAny: ["경구"],
      mechanisms: ["acid_control"],
      combinationRole: "primary",
      compatibleRoles: ["barrier_support"],
      priority: 80,
      source: "SRC-PRACTICE#page=4",
    },
    {
      pathwayId: "diarrhea",
      protocolId: "PTC-DIARRHEA",
      efficacyAny: ["설사"],
      routeFormAny: ["경구"],
      mechanisms: ["adsorbent", "antimicrobial"],
      combinationRole: "primary",
      priority: 80,
      source: "SRC-PRACTICE#page=5",
    },
  ],
  supportiveDirectRules: [
    {
      ruleId: "herbal-adjunct",
      itemNameAny: ["탕", "환"],
      supportMechanism: "herbal_support",
      scoreAdjustment: -20,
    },
  ],
  supportiveClassifications: [
    {
      pathwayId: "vitamin_support",
      officialCategoryAny: ["비타민"],
      priority: 10,
    },
  ],
});

describe("clinical pathway classifier", () => {
  it("classifies from official efficacy and route with auditable evidence", () => {
    expect(
      classifyOfficialProduct(
        {
          efficacy: "위산과다 및 속쓰림의 완화",
          route: "경구(내용액제)",
          dosageForm: "현탁액",
          officialCategory: "제산제",
        },
        dataset,
      ),
    ).toEqual([
      expect.objectContaining({
        pathwayId: "heartburn",
        protocolId: "PTC-HEARTBURN",
        matchType: "direct",
        matchedTerms: ["속쓰림", "위산과다"],
        mechanisms: ["acid_control"],
      }),
    ]);
  });

  it("does not classify a product with an incompatible route", () => {
    expect(
      classifyOfficialProduct(
        {
          efficacy: "속쓰림의 완화",
          route: "피부",
          dosageForm: "연고",
          officialCategory: "제산제",
        },
        dataset,
      ),
    ).toEqual([]);
  });

  it("keeps only mechanisms supported by the product composition", () => {
    expect(
      classifyOfficialProduct(
        {
          efficacy: "성인의 급성 및 만성 설사",
          route: "경구",
          dosageForm: "현탁액",
          officialCategory: "정장제",
          activeIngredientTexts: ["Diosmectite 디오스멕타이트 3g"],
        },
        dataset,
      )[0],
    ).toEqual(
      expect.objectContaining({
        pathwayId: "diarrhea",
        mechanisms: ["adsorbent"],
      }),
    );
  });

  it("marks a direct herbal formula as a compatible supportive role", () => {
    expect(
      classifyOfficialProduct(
        {
          efficacy: "속쓰림의 완화",
          route: "경구",
          dosageForm: "과립",
          officialCategory: "생약제제",
          itemName: "가미위장탕",
          activeIngredientTexts: ["Licorice 감초", "Poria 복령"],
        },
        dataset,
      )[0],
    ).toEqual(
      expect.objectContaining({
        combinationRole: "supportive",
        compatibleRoles: ["primary"],
        mechanisms: ["acid_control", "herbal_support"],
      }),
    );
  });

  it("uses a supportive classification only when no direct pathway matches", () => {
    expect(
      classifyOfficialProduct(
        {
          efficacy: "육체피로 시 비타민 보급",
          route: "경구",
          dosageForm: "정제",
          officialCategory: "기타의 비타민제",
        },
        dataset,
      )[0],
    ).toEqual(expect.objectContaining({ pathwayId: "vitamin_support" }));
  });

  it("does not turn a secondary symptom in an antiemetic indication into a headache pathway", () => {
    const guardedDataset = parseClinicalPathwayDataset({
      schemaVersion: "1.0.0",
      researchOnly: true,
      mechanismEvidence: {
        analgesia: [
          "\uC544\uC138\uD2B8\uC544\uBBF8\uB178\uD39C",
          "acetaminophen",
        ],
      },
      pathways: [
        {
          pathwayId: "headache",
          protocolId: "PTC-HEADACHE",
          efficacyAny: ["\uB450\uD1B5"],
          routeFormAny: ["\uACBD\uAD6C"],
          officialCategoryNone: ["\uCD5C\uD1A0\uC81C", "\uC9C4\uD1A0\uC81C"],
          activeIngredientNone: [
            "\uB371\uC2A4\uD2B8\uB85C\uBA54\uD1A0\uB974\uD310",
            "dextromethorphan",
          ],
          requireMechanismEvidence: true,
          mechanisms: ["analgesia"],
          combinationRole: "primary",
          priority: 80,
          source: "SRC-PRACTICE#page=3-4",
        },
      ],
      supportiveClassifications: [],
    });

    expect(
      classifyOfficialProduct(
        {
          efficacy:
            "\uBA40\uBBF8\uC5D0 \uC758\uD55C \uC5B4\uC9C0\uB7EC\uC6C0, \uAD6C\uD1A0, \uB450\uD1B5\uC758 \uC608\uBC29 \uBC0F \uC644\uD654",
          route: "\uACBD\uAD6C",
          dosageForm: "\uC800\uC791\uC815",
          officialCategory: "\uCD5C\uD1A0\uC81C, \uC9C4\uD1A0\uC81C",
          activeIngredientTexts: [
            "Dimenhydrinate \uB514\uBA58\uD788\uB4DC\uB9AC\uB124\uC774\uD2B8 20mg",
          ],
        },
        guardedDataset,
      ),
    ).toEqual([]);

    expect(
      classifyOfficialProduct(
        {
          efficacy:
            "\uAC10\uAE30\uC758 \uBC1C\uC5F4, \uB450\uD1B5, \uAE30\uCE68\uC758 \uC644\uD654",
          route: "\uACBD\uAD6C",
          dosageForm: "\uCEA1\uC290",
          officialCategory: "\uD574\uC5F4, \uC9C4\uD1B5, \uC18C\uC5FC\uC81C",
          activeIngredientTexts: [
            "Acetaminophen \uC544\uC138\uD2B8\uC544\uBBF8\uB178\uD39C 200mg",
            "Dextromethorphan \uB371\uC2A4\uD2B8\uB85C\uBA54\uD1A0\uB974\uD310 8mg",
          ],
        },
        guardedDataset,
      ),
    ).toEqual([]);

    expect(
      classifyOfficialProduct(
        {
          efficacy: "\uB450\uD1B5\uC758 \uC644\uD654",
          route: "\uACBD\uAD6C",
          dosageForm: "\uC815\uC81C",
          officialCategory: "\uD574\uC5F4\uC9C4\uD1B5\uC81C",
          activeIngredientTexts: [
            "Acetaminophen \uC544\uC138\uD2B8\uC544\uBBF8\uB178\uD39C 500mg",
          ],
        },
        guardedDataset,
      )[0],
    ).toEqual(expect.objectContaining({ pathwayId: "headache" }));
  });

  it("requires direct gas-treatment evidence instead of matching laxative side symptoms", () => {
    const guardedDataset = parseClinicalPathwayDataset({
      schemaVersion: "1.0.0",
      researchOnly: true,
      mechanismEvidence: {
        gas_reduction: ["\uC2DC\uBA54\uD2F0\uCF58", "simethicone"],
      },
      pathways: [
        {
          pathwayId: "gas",
          protocolId: "PTC-GAS",
          efficacyAny: ["\uBCF5\uBD80\uD33D\uB9CC", "\uAC00\uC2A4\uC81C\uAC70"],
          routeFormAny: ["\uACBD\uAD6C"],
          officialCategoryNone: ["\uD558\uC81C", "\uC644\uC7A5\uC81C"],
          requireMechanismEvidence: true,
          mechanisms: ["gas_reduction"],
          combinationRole: "supportive",
          priority: 80,
          source: "SRC-PRACTICE#page=4-5",
        },
      ],
      supportiveClassifications: [],
    });

    expect(
      classifyOfficialProduct(
        {
          efficacy:
            "\uBCC0\uBE44\uC640 \uBCC0\uBE44\uC5D0 \uB530\uB978 \uBCF5\uBD80\uD33D\uB9CC\uC758 \uC644\uD654",
          route: "\uACBD\uAD6C",
          dosageForm: "\uC7A5\uC6A9\uC815",
          officialCategory: "\uD558\uC81C, \uC644\uC7A5\uC81C",
          activeIngredientTexts: ["Bisacodyl \uBE44\uC0AC\uCF54\uB51C 5mg"],
        },
        guardedDataset,
      ),
    ).toEqual([]);

    expect(
      classifyOfficialProduct(
        {
          efficacy: "\uBCF5\uBD80\uD33D\uB9CC\uACFC \uAC00\uC2A4\uC81C\uAC70",
          route: "\uACBD\uAD6C",
          dosageForm: "\uD604\uD0C1\uC561",
          officialCategory: "\uC81C\uC0B0\uC81C",
          activeIngredientTexts: ["Simethicone \uC2DC\uBA54\uD2F0\uCF58 40mg"],
        },
        guardedDataset,
      )[0],
    ).toEqual(expect.objectContaining({ pathwayId: "gas" }));
  });

  it("creates stable but distinct canonical ingredient IDs", () => {
    expect(canonicalIngredientId("Acetaminophen 아세트아미노펜 500mg")).toBe(
      canonicalIngredientId("Acetaminophen 아세트아미노펜 500 mg"),
    );
    expect(canonicalIngredientId("Ibuprofen 이부프로펜 200mg")).not.toBe(
      canonicalIngredientId("Acetaminophen 아세트아미노펜 500mg"),
    );
  });
});
