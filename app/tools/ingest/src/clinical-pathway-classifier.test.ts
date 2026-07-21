import { describe, expect, it } from "vitest";
import {
  canonicalIngredientId,
  classifyOfficialProduct,
  parseClinicalPathwayDataset,
} from "./clinical-pathway-classifier.js";

const dataset = parseClinicalPathwayDataset({
  schemaVersion: "1.0.0",
  researchOnly: true,
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

  it("creates stable but distinct canonical ingredient IDs", () => {
    expect(canonicalIngredientId("Acetaminophen 아세트아미노펜 500mg")).toBe(
      canonicalIngredientId("Acetaminophen 아세트아미노펜 500 mg"),
    );
    expect(canonicalIngredientId("Ibuprofen 이부프로펜 200mg")).not.toBe(
      canonicalIngredientId("Acetaminophen 아세트아미노펜 500mg"),
    );
  });
});
