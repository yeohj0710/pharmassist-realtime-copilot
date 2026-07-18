import { describe, expect, it } from "vitest";
import {
  assertCanonicalLocalCatalogOutputPath,
  assertLocalCatalogOutputPath,
  buildLocalPharmacyCatalogCandidates,
} from "./local-pharmacy-catalog.js";

describe("local private pharmacy catalog candidate import", () => {
  const sourceRows = [
    {
      id: "retail-1",
      name: "둘코락스에스 장용정",
      capacity: "40정",
      category: "소화기",
      price: "19,000원",
      displayed_price_krw: 19_000,
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
    {
      id: "retail-2",
      name: "둘코락스에스장용정",
      capacity: "40 정",
      category: "소화기",
      price: "20,000원",
      displayed_price_krw: 20_000,
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
    {
      id: "retail-3",
      name: "닥터베아제",
      capacity: "10T",
      category: "소화기",
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
    {
      id: "retail-4",
      name: "어린이 비타민정",
      capacity: "30정",
      category: "비타민",
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
    {
      id: "retail-5",
      name: "피부 장벽 크림",
      capacity: "50ml",
      category: "코스메틱",
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
    {
      id: "retail-6",
      name: "비접촉 체온계",
      capacity: "1개",
      category: "의료기기",
      recorded_at: "2026-07-15",
      verification_status: "Firestore 원본 확인",
    },
  ] as const;

  const runtimeProducts = [
    { productId: "PRD-DULCOLAX", displayName: "둘코락스에스장용정" },
    { productId: "PRD-DR-BEARSE", displayName: "닥터베아제정" },
  ] as const;

  it("groups normalized name and capacity while preserving every source SKU ID", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      sourceRows,
      runtimeProducts,
    );
    const dulcolax = result.candidates.find(
      (candidate) => candidate.normalizedName === "둘코락스에스장용정",
    );

    expect(result.report.sourceSkuCount).toBe(6);
    expect(result.report.candidateGroupCount).toBe(5);
    expect(result.report.nameCapacityDuplicateGroupCount).toBe(1);
    expect(result.report.skusInNameCapacityDuplicateGroups).toBe(2);
    expect(dulcolax?.sourceSkuIds).toEqual(["retail-1", "retail-2"]);
    expect(dulcolax?.runtimeIntersection).toEqual({
      status: "exact_name",
      productIds: ["PRD-DULCOLAX"],
    });
  });

  it("routes regulatory domains without treating merchandising categories as official classifications", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      sourceRows,
      runtimeProducts,
    );
    const byId = new Map(
      result.candidates.flatMap((candidate) =>
        candidate.sourceSkuIds.map((id) => [id, candidate] as const),
      ),
    );

    expect(byId.get("retail-4")?.classification).toEqual({
      route: "medicine_or_health_supplement_review",
      regulatoryClassCandidates: ["medicine", "health_supplement"],
      officialLookupTargets: ["mfds_otc", "mfds_health_supplement"],
      mfdsOtcScreeningRequired: true,
      reviewRequired: true,
    });
    expect(byId.get("retail-5")?.classification).toEqual({
      route: "cosmetic",
      regulatoryClassCandidates: ["cosmetic"],
      officialLookupTargets: ["mfds_cosmetic"],
      mfdsOtcScreeningRequired: false,
      reviewRequired: true,
    });
    expect(byId.get("retail-6")?.classification).toEqual({
      route: "medical_device",
      regulatoryClassCandidates: ["medical_device"],
      officialLookupTargets: ["mfds_medical_device"],
      mfdsOtcScreeningRequired: false,
      reviewRequired: true,
    });
    expect(byId.get("retail-3")?.classification.route).toBe(
      "medicine_or_unresolved_review",
    );
  });

  it("keeps exact and near-name runtime intersections separate", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      sourceRows,
      runtimeProducts,
    );
    const near = result.candidates.find((candidate) =>
      candidate.sourceSkuIds.includes("retail-3"),
    );

    expect(near?.runtimeIntersection).toEqual({
      status: "near_name_review",
      productIds: ["PRD-DR-BEARSE"],
    });
    expect(result.report.runtimeIntersection.exactCandidateGroupCount).toBe(1);
    expect(result.report.runtimeIntersection.nearNameReviewGroupCount).toBe(1);
    expect(result.report.runtimeIntersection.missingCandidateGroupCount).toBe(
      4,
    );
  });

  it("never copies price or promotes an unverified retail candidate", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      sourceRows,
      runtimeProducts,
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("19,000원");
    expect(
      result.candidates.every(
        (candidate) =>
          candidate.candidateOnly &&
          candidate.clinicalUseProhibited &&
          !candidate.formularyEligible &&
          candidate.officialMatch.status === "required",
      ),
    ).toBe(true);
    expect(result.report.officialMatching.confirmedSkuCount).toBe(0);
    expect(result.report.officialMatching.requiredSkuCount).toBe(6);
  });

  it("allows generated private data only below the workspace etc directory", () => {
    expect(
      assertLocalCatalogOutputPath(
        "C:/dev/pharmassist-realtime-copilot",
        "C:/dev/pharmacy-product-catalog",
        "C:/dev/pharmassist-realtime-copilot/etc/pharmacy-product-catalog-candidate",
      ),
    ).toMatch(/etc[\\/]pharmacy-product-catalog-candidate$/u);
    expect(() =>
      assertLocalCatalogOutputPath(
        "C:/dev/pharmassist-realtime-copilot",
        "C:/dev/pharmacy-product-catalog",
        "C:/dev/pharmassist-realtime-copilot/etc/alternate-catalog",
      ),
    ).toThrow("fixed private");
    expect(() =>
      assertLocalCatalogOutputPath(
        "C:/dev/pharmassist-realtime-copilot",
        "C:/dev/pharmacy-product-catalog",
        "C:/dev/pharmassist-realtime-copilot/app/data/local-catalog",
      ),
    ).toThrow("fixed private");
    expect(() =>
      assertLocalCatalogOutputPath(
        "C:/dev/pharmassist-realtime-copilot",
        "C:/dev/pharmacy-product-catalog",
        "C:/dev/pharmacy-product-catalog/data/derived",
      ),
    ).toThrow("fixed private");

    expect(() =>
      assertCanonicalLocalCatalogOutputPath({
        workspaceRoot: "C:/dev/pharmassist-realtime-copilot",
        privateRoot: "C:/dev/pharmassist-realtime-copilot/etc",
        sourceRoot: "C:/dev/pharmacy-product-catalog",
        outputDirectory: "C:/dev/pharmassist-realtime-copilot/app/data/escaped",
      }),
    ).toThrow("canonical private");
  });

  it("does not merge products that differ only by parenthetical ingredient text", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      [
        {
          id: "ingredient-a",
          name: "이큐펜키즈A(아세트아미노펜)",
          capacity: "10포",
          category: "키즈",
        },
        {
          id: "ingredient-b",
          name: "이큐펜키즈A(이부프로펜)",
          capacity: "10포",
          category: "키즈",
        },
      ],
      [],
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.report.sourceNameDuplicateGroupCount).toBe(0);
    expect(result.report.nameCapacityDuplicateGroupCount).toBe(0);
  });

  it("unions official lookup targets when grouped merchandising categories conflict", () => {
    const result = buildLocalPharmacyCatalogCandidates(
      [
        {
          id: "mixed-cosmetic",
          name: "동일 표시 제품",
          capacity: "1개",
          category: "코스메틱",
        },
        {
          id: "mixed-supplement",
          name: "동일표시제품",
          capacity: "1 개",
          category: "비타민",
        },
      ],
      [],
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.classification).toEqual({
      route: "mixed_regulatory_domains_review",
      regulatoryClassCandidates: ["medicine", "health_supplement", "cosmetic"],
      officialLookupTargets: [
        "mfds_otc",
        "mfds_health_supplement",
        "mfds_cosmetic",
      ],
      mfdsOtcScreeningRequired: true,
      reviewRequired: true,
    });
  });
});
