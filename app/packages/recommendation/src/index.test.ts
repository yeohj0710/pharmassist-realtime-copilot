import type {
  ConsultationState,
  DrugProduct,
  ProductIngredient,
  TenantFormulary,
  TenantInventory,
  TenantSalesAggregate,
} from "@pharmassist/contracts";
import type { NormalizedInput, SafetyDecision } from "@pharmassist/domain";
import {
  syntheticClaims,
  syntheticFormulary,
  syntheticIngredients,
  syntheticInventory,
  syntheticPack,
  syntheticProductIngredients,
  syntheticProducts,
  syntheticProtocolOptions,
  syntheticProtocolRules,
  syntheticProtocols,
  syntheticSales,
} from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  assertDecisionInvariants,
  buildRecommendationDecision,
  nextConsultationState,
  nextProtocolQuestion,
  renderDecisionSentence,
} from "./index.js";

const normalized = (
  text: string,
  slots: NormalizedInput["slots"] = {},
): NormalizedInput => ({
  displayText: text,
  normalizedText: text,
  redactedText: text,
  safeForExternal: true,
  findings: [],
  alternatives: [],
  tokens: text.split(/\s+/u),
  slots,
  personScope: "self",
  temporality: "current",
});

const safe: SafetyDecision = {
  mode: "continue",
  ruleIds: [],
  redFlags: [],
  missingSlots: [],
  sayNow: [],
  lockCritical: false,
};

const knowledge = {
  packId: syntheticPack.packId,
  sourceSnapshotIds: new Set(
    syntheticPack.sources.map((item) => item.source_snapshot_id),
  ),
  ingredients: syntheticIngredients,
  products: syntheticProducts,
  productIngredients: syntheticProductIngredients,
  claims: syntheticClaims,
  protocolOptions: syntheticProtocolOptions,
  protocolRules: syntheticProtocolRules,
};

const protocol = (category: string) => {
  const item = syntheticProtocols.find(
    (candidate) => candidate.symptom_category === category,
  );
  if (!item) throw new Error(`missing synthetic protocol: ${category}`);
  return item;
};

const request = (
  category: string,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  sequence: 1,
  sessionId: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  now: new Date("2026-07-13T00:00:00Z"),
  normalized: normalized("속이 쓰려요"),
  safety: safe,
  protocol: protocol(category),
  knowledge,
  tenant: {
    tenantId: "demo",
    formulary: syntheticFormulary,
    inventory: syntheticInventory,
    sales: syntheticSales,
  },
  ...overrides,
});

type ImportedProduct = DrugProduct &
  Readonly<{
    official_match_status:
      "confirmed" | "review_required" | "not_found" | "not_applicable";
    official_product_key: string;
    official_source_url: string;
    retail_offer: Readonly<{
      sku_id: string;
      display_name: string;
      specification: string;
      displayed_price_krw: number;
      recorded_at: string;
      price_status: string;
    }>;
    protocol_ids: readonly string[];
    clinical_group_key: string;
    indication_summary: string;
    dosage_summary: string;
    precaution_summary: string;
    interactions: readonly string[];
    permit_cancelled: boolean;
  }>;

const importedProduct = (
  suffix: string,
  overrides: Partial<ImportedProduct> = {},
): ImportedProduct => {
  const base = syntheticProducts.find(
    (item) => item.product_id === "PRD-SYN-HEARTBURN",
  );
  if (!base) throw new Error("heartburn product fixture missing");
  return {
    ...base,
    product_id: `PRD-HEALTHKR-${suffix}`,
    item_seq: `HEALTHKR-${suffix}`,
    display_name: `공식 속쓰림 제품 ${suffix}`,
    official_match_status: "confirmed",
    official_product_key: `HEALTHKR-${suffix}`,
    official_source_url: `https://health.kr/product/${suffix}`,
    retail_offer: {
      sku_id: `SKU-${suffix}`,
      display_name: `판매 속쓰림 제품 ${suffix}`,
      specification: "10정",
      displayed_price_krw: 10_000,
      recorded_at: "2026-07-15",
      price_status: "2026-07-15 표시 가격",
      image_url: "https://images.example/product.jpg",
      image_source_url: "https://images.example/product",
      image_rights_status: "verified",
      image_kind: "package",
      image_checked_at: "2026-07-16T16:18:00+09:00",
    },
    protocol_ids: ["PTC-HEARTBURN"],
    clinical_group_key: "ING-SYN-HEARTBURN|정제|경구",
    indication_summary: "속쓰림 완화",
    dosage_form: "정제",
    route: "경구(내용고형)",
    dosage_summary: "허가 용법을 확인하세요.",
    precaution_summary: "과민반응이 있으면 사용하지 마세요.",
    interactions: [],
    permit_cancelled: false,
    ...overrides,
  } as ImportedProduct;
};

const importedLink = (product: ImportedProduct): ProductIngredient => {
  const base = syntheticProductIngredients.find(
    (item) => item.product_id === "PRD-SYN-HEARTBURN",
  );
  if (!base) throw new Error("heartburn ingredient link fixture missing");
  return {
    ...base,
    product_ingredient_id: `PRI-${product.product_id}`,
    product_id: product.product_id,
  };
};

const importedDecision = (
  products: readonly ImportedProduct[],
  normalizedInput: NormalizedInput = normalized("속이 쓰려요"),
) => {
  const baseRequest = request("heartburn");
  const sourceProtocolId = baseRequest.protocol.protocol_id;
  const protocol = {
    ...baseRequest.protocol,
    protocol_id: "PTC-HEARTBURN",
  };
  const links = products.map(importedLink);
  const formulary: TenantFormulary = {
    ...syntheticFormulary,
    formulary_id: "FRM-HEALTHKR-RESEARCH-PREVIEW",
    tenant_id: "local-research-preview",
    entries: products.map((product) => ({
      product_id: product.product_id,
      ingredient_id: links.find(
        (link) => link.product_id === product.product_id,
      )!.ingredient_id,
      symptom_category: "heartburn",
      active: true,
      pharmacist_approved: false,
      preferred: false,
      notes: "공식 연결 연구 미리보기",
    })),
    review: {
      ...syntheticFormulary.review,
      pharmacist_approved: false,
      official_source_verified: false,
      reviewer_ids: ["LOCAL-RESEARCH-PREVIEW"],
    },
  };
  return buildRecommendationDecision({
    ...baseRequest,
    protocol,
    normalized: normalizedInput,
    knowledge: {
      ...baseRequest.knowledge,
      products,
      productIngredients: links,
      protocolOptions: baseRequest.knowledge.protocolOptions.map((option) =>
        option.protocol_id === sourceProtocolId
          ? { ...option, protocol_id: protocol.protocol_id }
          : option,
      ),
      protocolRules: baseRequest.knowledge.protocolRules.map((rule) =>
        rule.protocol_id === sourceProtocolId
          ? { ...rule, protocol_id: protocol.protocol_id }
          : rule,
      ),
    },
    tenant: {
      tenantId: "local-research-preview",
      formulary,
    },
  });
};

describe("verified recommendation decision", () => {
  it("requires an active-pack ingredient and an in-stock formulary product", () => {
    const decision = buildRecommendationDecision(request("heartburn"));
    expect(decision.status).toBe("recommend");
    expect(decision.pack_id).toBe(syntheticPack.packId);
    expect(decision.ingredient_options).toHaveLength(1);
    expect(decision.product_candidates).toHaveLength(1);
    expect(decision.source_refs.length).toBeGreaterThan(0);
    expect(assertDecisionInvariants(decision)).toEqual([]);
  });

  it("returns one candidate card per official product when formulary links repeat", () => {
    const repeatedEntry = syntheticFormulary.entries.find(
      (entry) => entry.symptom_category === "heartburn",
    );
    if (!repeatedEntry) throw new Error("heartburn formulary fixture missing");
    const formulary: TenantFormulary = {
      ...syntheticFormulary,
      entries: [...syntheticFormulary.entries, { ...repeatedEntry }],
    };

    const decision = buildRecommendationDecision(
      request("heartburn", {
        tenant: {
          tenantId: "demo",
          formulary,
          inventory: syntheticInventory,
          sales: syntheticSales,
        },
      }),
    );

    expect(decision.product_candidates).toHaveLength(1);
    expect(
      new Set(decision.product_candidates.map((item) => item.product_id)).size,
    ).toBe(decision.product_candidates.length);
  });

  it("ranks structured therapeutic role before legacy numeric priority", () => {
    const base = request("heartburn");
    const sourceOption = syntheticProtocolOptions.find(
      (option) => option.protocol_id === base.protocol.protocol_id,
    );
    if (!sourceOption) throw new Error("heartburn option fixture missing");
    const alternative = {
      ...sourceOption,
      clinical_priority: 100,
      therapeutic_role: "alternative" as const,
    };
    const preferred = {
      ...sourceOption,
      option_id: "OPT-SYN-HEARTBURN-PREFERRED",
      clinical_priority: 1,
      safety_priority: 1,
      therapeutic_role: "preferred" as const,
    };
    const conditional = {
      ...sourceOption,
      option_id: "OPT-SYN-HEARTBURN-CONDITIONAL",
      clinical_priority: 100,
      therapeutic_role: "conditional" as const,
    };

    const decision = buildRecommendationDecision(
      request("heartburn", {
        protocol: {
          ...base.protocol,
          option_ids: [
            alternative.option_id,
            conditional.option_id,
            preferred.option_id,
          ],
        },
        knowledge: {
          ...knowledge,
          protocolOptions: [
            ...syntheticProtocolOptions.filter(
              (option) => option.option_id !== sourceOption.option_id,
            ),
            alternative,
            conditional,
            preferred,
          ],
        },
      }),
    );

    expect(decision.ingredient_options.map((item) => item.option_id)).toEqual([
      preferred.option_id,
      alternative.option_id,
    ]);

    const sourceRule = syntheticProtocolRules.find(
      (rule) => rule.protocol_id === base.protocol.protocol_id,
    );
    if (!sourceRule) throw new Error("heartburn rule fixture missing");
    const askRule = {
      ...sourceRule,
      rule_id: "RUL-SYN-HEARTBURN-THERAPEUTIC-ASK",
      effect: "ask" as const,
      field: "symptom.therapeutic_pattern",
      operator: "present" as const,
      option_ids: [conditional.option_id],
      question: "조건부 후보가 필요한 증상인가요?",
      priority: 1,
    };
    const selectRule = {
      ...sourceRule,
      rule_id: "RUL-SYN-HEARTBURN-THERAPEUTIC-SELECT",
      effect: "select" as const,
      field: "symptom.therapeutic_pattern",
      operator: "equals" as const,
      value: "conditional",
      option_ids: [conditional.option_id],
      question: null,
      priority: 2,
    };
    const selectedConditional = buildRecommendationDecision(
      request("heartburn", {
        protocol: {
          ...base.protocol,
          option_ids: [alternative.option_id, conditional.option_id],
          rule_ids: [
            ...base.protocol.rule_ids,
            askRule.rule_id,
            selectRule.rule_id,
          ],
        },
        consultationState: {
          session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
          tenant_id: "demo",
          sequence: 1,
          pack_id: syntheticPack.packId,
          answered_slots: {
            "symptom.therapeutic_pattern": "conditional",
          },
          asked_slots: ["symptom.therapeutic_pattern"],
          topics: [],
          pending_question_slot: null,
          active_protocol_id: base.protocol.protocol_id,
          active_intent: base.protocol.intent,
          last_decision_status: "ask" as const,
          updated_at: "2026-07-13T00:00:00Z",
        },
        knowledge: {
          ...knowledge,
          protocolOptions: [
            ...syntheticProtocolOptions.filter(
              (option) => option.option_id !== sourceOption.option_id,
            ),
            alternative,
            conditional,
          ],
          protocolRules: [...syntheticProtocolRules, askRule, selectRule],
        },
      }),
    );

    expect(
      selectedConditional.ingredient_options.map((item) => item.option_id),
    ).toEqual([conditional.option_id]);
  });

  it("rejects a same-ingredient formulary product without product-level indication evidence", () => {
    const baseProduct = syntheticProducts.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    const baseLink = syntheticProductIngredients.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    if (!baseProduct || !baseLink) throw new Error("heartburn fixture missing");
    const unsupportedProduct: DrugProduct = {
      ...baseProduct,
      product_id: "PRD-SYN-HEARTBURN-UNSUPPORTED",
      item_seq: "SYN-HEARTBURN-UNSUPPORTED",
      display_name: "근거가 연결되지 않은 동일 성분 제품",
    };
    const unsupportedLink: ProductIngredient = {
      ...baseLink,
      product_ingredient_id: "PRI-SYN-HEARTBURN-UNSUPPORTED",
      product_id: unsupportedProduct.product_id,
    };
    const formulary: TenantFormulary = {
      ...syntheticFormulary,
      entries: [
        ...syntheticFormulary.entries,
        {
          product_id: unsupportedProduct.product_id,
          ingredient_id: baseLink.ingredient_id,
          symptom_category: "heartburn",
          active: true,
          pharmacist_approved: true,
          preferred: false,
          notes: "Same ingredient without indication evidence",
        },
      ],
    };

    const decision = buildRecommendationDecision(
      request("heartburn", {
        knowledge: {
          ...knowledge,
          products: [...syntheticProducts, unsupportedProduct],
          productIngredients: [...syntheticProductIngredients, unsupportedLink],
        },
        tenant: {
          tenantId: "demo",
          formulary,
          inventory: undefined,
          sales: undefined,
        },
      }),
    );

    expect(decision.product_candidates.map((item) => item.product_id)).toEqual([
      baseProduct.product_id,
    ]);
  });

  it("allows only a confirmed active HealthKR product for its exact protocol in research preview", () => {
    const product = importedProduct("CONFIRMED");
    const decision = importedDecision([product]);
    const candidate = decision.product_candidates[0] as
      Readonly<Record<string, unknown>> | undefined;

    expect(decision.status).toBe("recommend");
    expect(candidate).toMatchObject({
      product_id: product.product_id,
      display_name: product.retail_offer.display_name,
      specification: product.retail_offer.specification,
      displayed_price_krw: product.retail_offer.displayed_price_krw,
      price_recorded_at: product.retail_offer.recorded_at,
      image_url: product.retail_offer.image_url,
      image_source_url: product.retail_offer.image_source_url,
      image_rights_status: product.retail_offer.image_rights_status,
      official_match_status: "confirmed",
      official_source_url: product.official_source_url,
      indication_summary: product.indication_summary,
      dosage_summary: product.dosage_summary,
      precaution_summary: product.precaution_summary,
    });
  });

  it.each([
    ["unconfirmed", { official_match_status: "review_required" as const }],
    ["cancelled", { permit_cancelled: true }],
    ["wrong protocol", { protocol_ids: ["PTC-OTHER"] }],
  ])("excludes an imported %s product", (_label, overrides) => {
    const decision = importedDecision([
      importedProduct("INELIGIBLE", overrides),
    ]);
    expect(decision.product_candidates).toEqual([]);
  });

  it("revalidates imported indication, dosage form, and route independently of protocol IDs", () => {
    const wrongRoute = importedProduct("WRONG-ROUTE", {
      indication_summary: "안구 건조 증상의 완화",
      dosage_form: "점안제",
      route: "눈",
    });
    const wrongIndication = importedProduct("WRONG-INDICATION", {
      indication_summary: "변비의 완화",
      dosage_form: "정제",
      route: "경구(내용고형)",
    });

    expect(
      importedDecision([wrongRoute, wrongIndication]).product_candidates,
    ).toEqual([]);
  });

  it("excludes an imported product when an age DUR restriction applies", () => {
    const product = importedProduct("AGE", {
      dur_flags: [
        {
          type: "age",
          code: "DUR-AGE-12",
          description: "12세 미만 투여금기",
          blocking: true,
        },
      ],
    });
    const decision = importedDecision(
      [product],
      normalized("속이 쓰려요", {
        age_years: {
          value: 8,
          provenance: "context",
          confidence: 1,
          verified: true,
        },
      }),
    );
    expect(decision.product_candidates).toEqual([]);
    expect(importedDecision([product]).product_candidates).toEqual([]);
  });

  it("applies month-based age DUR restrictions", () => {
    const product = importedProduct("AGE-MONTHS", {
      dur_flags: [
        {
          type: "age",
          code: "DUR-AGE-6-MONTHS",
          description: "6개월 미만",
          blocking: true,
        },
      ],
    });
    const withAge = (value: number) =>
      importedDecision(
        [product],
        normalized("속이 쓰려요", {
          age_years: {
            value,
            provenance: "context",
            confidence: 1,
            verified: true,
          },
        }),
      );

    expect(withAge(0.25).product_candidates).toEqual([]);
    expect(withAge(1).product_candidates).toHaveLength(1);
  });

  it("requires a confirmed child age before recommending a pediatric-only retail offer", () => {
    const pediatric = importedProduct("PEDIATRIC", {
      display_name: "어린이 속쓰림 시럽",
      retail_offer: {
        ...importedProduct("PEDIATRIC-BASE").retail_offer,
        sku_id: "SKU-PEDIATRIC",
        display_name: "어린이 속쓰림 시럽",
      },
      dosage_summary: "소아는 연령별 허가 용량을 확인하세요.",
    });

    expect(importedDecision([pediatric]).product_candidates).toEqual([]);
    expect(
      importedDecision(
        [pediatric],
        normalized("속이 쓰려요", {
          age_years: {
            value: 8,
            provenance: "context",
            confidence: 1,
            verified: true,
          },
        }),
      ).product_candidates,
    ).toHaveLength(1);
  });

  it("excludes an imported product when a pregnancy DUR restriction applies", () => {
    const product = importedProduct("PREGNANCY", {
      dur_flags: [
        {
          type: "pregnancy",
          code: "DUR-PREGNANCY",
          description: "임부 투여금기",
          blocking: true,
        },
      ],
    });
    const decision = importedDecision(
      [product],
      normalized("속이 쓰려요", {
        pregnancy_status: {
          value: "pregnant",
          provenance: "context",
          confidence: 1,
          verified: true,
        },
      }),
    );
    expect(decision.product_candidates).toEqual([]);
    expect(importedDecision([product]).product_candidates).toEqual([]);
    expect(
      importedDecision(
        [product],
        normalized("속이 쓰려요", {
          pregnancy_status: {
            value: "not_pregnant",
            provenance: "context",
            confidence: 1,
            verified: true,
          },
        }),
      ).product_candidates,
    ).toHaveLength(1);
  });

  it("excludes allergy, interaction, and unconditional blocking DUR matches", () => {
    const base = importedProduct("SAFETY");
    const ingredientName = base.active_ingredients?.[0]?.name;
    if (!ingredientName) throw new Error("active ingredient fixture missing");

    const allergy = importedDecision(
      [base],
      normalized("속이 쓰려요", {
        allergies: {
          value: [ingredientName],
          provenance: "context",
          confidence: 1,
          verified: true,
        },
      }),
    );
    expect(allergy.product_candidates).toEqual([]);

    const interaction = importedDecision(
      [
        importedProduct("INTERACTION", {
          interactions: ["와파린과 병용하지 않습니다."],
        }),
      ],
      normalized("속이 쓰려요", {
        current_products: {
          value: ["와파린"],
          provenance: "context",
          confidence: 1,
          verified: true,
        },
      }),
    );
    expect(interaction.product_candidates).toEqual([]);

    const blockingDur = importedDecision([
      importedProduct("BLOCKED-DUR", {
        dur_flags: [
          {
            type: "other",
            code: "DUR-BLOCK",
            description: "자동 추천 금지",
            blocking: true,
          },
        ],
      }),
    ]);
    expect(blockingDur.product_candidates).toEqual([]);
  });

  it("groups clinically equivalent products and uses price only as a nonclinical tie-break", () => {
    const expensive = importedProduct("EXPENSIVE", {
      retail_offer: {
        ...importedProduct("EXPENSIVE-BASE").retail_offer,
        sku_id: "SKU-EXPENSIVE",
        display_name: "판매 속쓰림 제품 고가",
        displayed_price_krw: 20_000,
      },
    });
    const affordable = importedProduct("AFFORDABLE", {
      retail_offer: {
        ...importedProduct("AFFORDABLE-BASE").retail_offer,
        sku_id: "SKU-AFFORDABLE",
        display_name: "판매 속쓰림 제품 저가",
        displayed_price_krw: 8_000,
      },
    });
    const decision = importedDecision([expensive, affordable]);
    const candidate = decision.product_candidates[0] as
      Readonly<Record<string, unknown>> | undefined;

    expect(decision.product_candidates).toHaveLength(1);
    expect(candidate).toMatchObject({
      product_id: affordable.product_id,
      displayed_price_krw: 8_000,
      clinical_group_key: affordable.clinical_group_key,
      same_group_product_count: 2,
    });
  });

  it("does not recommend when connected inventory has no eligible stock", () => {
    const inventory: readonly TenantInventory[] = syntheticInventory.map(
      (item) => ({
        ...item,
        available_quantity: 0,
        status: "out_of_stock" as const,
      }),
    );
    const decision = buildRecommendationDecision(
      request("heartburn", {
        tenant: {
          tenantId: "demo",
          formulary: syntheticFormulary,
          inventory,
          sales: syntheticSales,
        },
      }),
    );
    expect(decision.status).toBe("insufficient");
    expect(decision.product_candidates).toEqual([]);
    expect(decision.reason_codes).toContain("NO_IN_STOCK_FORMULARY_PRODUCT");
  });

  it("does not claim verified stock for a disconnected inventory", () => {
    const decision = buildRecommendationDecision(
      request("heartburn", {
        tenant: {
          tenantId: "demo",
          formulary: syntheticFormulary,
          inventory: undefined,
          sales: undefined,
        },
      }),
    );
    expect(decision.status).toBe("recommend");
    expect(decision.product_candidates[0]?.inventory_status).toBe(
      "not_connected",
    );
    expect(renderDecisionSentence(decision)).toBe(
      "많이 불편하셨겠어요. 말씀해 주신 증상에는 우선 검토용 속쓰림 제품 A를 살펴보면 좋겠어요. 이 제품에는 검토용 속쓰림 성분 A 성분이 들어 있어요.",
    );
    expect(renderDecisionSentence(decision)).not.toMatch(
      /근거가 연결된|상황으로 보입니다|고려해볼 수 있습니다/u,
    );
    expect(renderDecisionSentence(decision)).toContain("우선");
    expect(renderDecisionSentence(decision)).not.toContain("부터 확인");
    expect(renderDecisionSentence(decision)).not.toContain("재고");
  });

  it("does not treat missing supply performance as a permit or formulary rejection", () => {
    const decision = buildRecommendationDecision(
      request("heartburn", {
        knowledge: {
          ...knowledge,
          products: syntheticProducts.map((product) =>
            product.product_id === "PRD-SYN-HEARTBURN"
              ? { ...product, supply_performance: false }
              : product,
          ),
        },
      }),
    );

    expect(decision.status).toBe("recommend");
    expect(decision.product_candidates).toHaveLength(1);
    expect(decision.product_candidates[0]?.product_id).toBe(
      "PRD-SYN-HEARTBURN",
    );
  });

  it("ranks inventory before sales frequency among clinically equal products", () => {
    const baseProduct = syntheticProducts.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    const baseLink = syntheticProductIngredients.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    if (!baseProduct || !baseLink) throw new Error("heartburn fixture missing");
    const secondProduct: DrugProduct = {
      ...baseProduct,
      product_id: "PRD-SYN-HEARTBURN-B",
      item_seq: "SYN-HEARTBURN-B",
      display_name: "검토용 속쓰림 제품 B",
    };
    const secondLink: ProductIngredient = {
      ...baseLink,
      product_ingredient_id: "PRI-SYN-HEARTBURN-B",
      product_id: secondProduct.product_id,
    };
    const formulary: TenantFormulary = {
      ...syntheticFormulary,
      entries: [
        ...syntheticFormulary.entries,
        {
          product_id: secondProduct.product_id,
          ingredient_id: baseLink.ingredient_id,
          symptom_category: "heartburn",
          active: true,
          pharmacist_approved: true,
          preferred: false,
          notes: "Synthetic ranking fixture",
        },
      ],
    };
    const originalInventory = syntheticInventory.find(
      (item) => item.product_id === baseProduct.product_id,
    );
    if (!originalInventory) throw new Error("inventory fixture missing");
    const inventory: readonly TenantInventory[] = [
      { ...originalInventory, available_quantity: 1 },
      {
        ...originalInventory,
        inventory_id: "INV-SYN-HEARTBURN-B",
        product_id: secondProduct.product_id,
        available_quantity: 10,
      },
    ];
    const originalSales = syntheticSales.find(
      (item) => item.product_id === baseProduct.product_id,
    );
    if (!originalSales) throw new Error("sales fixture missing");
    const sales: readonly TenantSalesAggregate[] = [
      { ...originalSales, sales_rank: 1 },
      {
        ...originalSales,
        product_id: secondProduct.product_id,
        sales_rank: 99,
        units_sold: 1,
      },
    ];
    const claims = syntheticClaims.map((claim) =>
      claim.subject_id === baseLink.ingredient_id &&
      typeof claim.object === "object" &&
      claim.object !== null &&
      !Array.isArray(claim.object)
        ? {
            ...claim,
            object: {
              ...claim.object,
              candidate_product_ids: [
                baseProduct.product_id,
                secondProduct.product_id,
              ],
            },
          }
        : claim,
    );
    const decision = buildRecommendationDecision(
      request("heartburn", {
        knowledge: {
          ...knowledge,
          claims,
          products: [...syntheticProducts, secondProduct],
          productIngredients: [...syntheticProductIngredients, secondLink],
        },
        tenant: { tenantId: "demo", formulary, inventory, sales },
      }),
    );
    expect(decision.status).toBe("recommend");
    expect(decision.product_candidates[0]?.product_id).toBe(
      secondProduct.product_id,
    );
  });

  it("uses only current 90-day sales from the same symptom as the final tie-break", () => {
    const baseProduct = syntheticProducts.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    const baseLink = syntheticProductIngredients.find(
      (item) => item.product_id === "PRD-SYN-HEARTBURN",
    );
    const originalInventory = syntheticInventory.find(
      (item) => item.product_id === baseProduct?.product_id,
    );
    const originalSales = syntheticSales.find(
      (item) => item.product_id === baseProduct?.product_id,
    );
    if (!baseProduct || !baseLink || !originalInventory || !originalSales)
      throw new Error("heartburn ranking fixtures missing");
    const secondProduct: DrugProduct = {
      ...baseProduct,
      product_id: "PRD-SYN-HEARTBURN-SALES",
      item_seq: "SYN-HEARTBURN-SALES",
      display_name: "검토용 속쓰림 판매 후보",
    };
    const secondLink: ProductIngredient = {
      ...baseLink,
      product_ingredient_id: "PRI-SYN-HEARTBURN-SALES",
      product_id: secondProduct.product_id,
    };
    const formulary: TenantFormulary = {
      ...syntheticFormulary,
      entries: [
        ...syntheticFormulary.entries,
        {
          product_id: secondProduct.product_id,
          ingredient_id: baseLink.ingredient_id,
          symptom_category: "heartburn",
          active: true,
          pharmacist_approved: true,
          preferred: false,
          notes: "Synthetic sales window fixture",
        },
      ],
    };
    const claims = syntheticClaims.map((claim) =>
      claim.subject_id === baseLink.ingredient_id &&
      typeof claim.object === "object" &&
      claim.object !== null &&
      !Array.isArray(claim.object)
        ? {
            ...claim,
            object: {
              ...claim.object,
              candidate_product_ids: [
                baseProduct.product_id,
                secondProduct.product_id,
              ],
            },
          }
        : claim,
    );
    const inventory: readonly TenantInventory[] = [
      { ...originalInventory, available_quantity: 10 },
      {
        ...originalInventory,
        inventory_id: "INV-SYN-HEARTBURN-SALES",
        product_id: secondProduct.product_id,
        available_quantity: 10,
      },
    ];
    const choose = (secondSales: TenantSalesAggregate): string | undefined =>
      buildRecommendationDecision(
        request("heartburn", {
          knowledge: {
            ...knowledge,
            claims,
            products: [...syntheticProducts, secondProduct],
            productIngredients: [...syntheticProductIngredients, secondLink],
          },
          tenant: {
            tenantId: "demo",
            formulary,
            inventory,
            sales: [{ ...originalSales, sales_rank: 9 }, secondSales],
          },
        }),
      ).product_candidates[0]?.product_id;
    const currentSecond: TenantSalesAggregate = {
      ...originalSales,
      product_id: secondProduct.product_id,
      sales_rank: 1,
    };

    expect(choose(currentSecond)).toBe(secondProduct.product_id);
    expect(
      choose({
        ...currentSecond,
        window_start: "2025-01-01",
        window_end: "2025-03-31",
      }),
    ).toBe(baseProduct.product_id);
    expect(choose({ ...currentSecond, symptom_category: "cough" })).toBe(
      baseProduct.product_id,
    );
  });

  it("turns a safety escalation into refer without candidates", () => {
    const decision = buildRecommendationDecision(
      request("heartburn", {
        safety: {
          mode: "escalate",
          ruleIds: ["RF-BREATHING"],
          redFlags: [
            {
              flag_id: "RF-BREATHING",
              label: "심한 호흡 곤란",
              action: "emergency",
              matched: true,
            },
          ],
          missingSlots: [],
          sayNow: ["즉시 응급평가가 필요합니다."],
          lockCritical: true,
        } satisfies SafetyDecision,
      }),
    );
    expect(decision.status).toBe("refer");
    expect(decision.ingredient_options).toEqual([]);
    expect(decision.product_candidates).toEqual([]);
    expect(assertDecisionInvariants(decision)).toEqual([]);
  });

  it("treats array-valued matches rules as safe literal alternatives", () => {
    const base = request("heartburn");
    const optionId = syntheticProtocolOptions.find(
      (option) => option.protocol_id === base.protocol.protocol_id,
    )?.option_id;
    if (!optionId) throw new Error("heartburn option fixture missing");
    const arrayRule = {
      ...syntheticProtocolRules[0]!,
      rule_id: "RUL-ARRAY-LITERAL-EXCLUSION",
      protocol_id: base.protocol.protocol_id,
      effect: "exclude" as const,
      field: "eligibility.test.contraindications",
      operator: "matches" as const,
      value: ["pregnancy.no", "allergy"],
      option_ids: [optionId],
    };
    const withAnswer = (answer: string) =>
      buildRecommendationDecision(
        request("heartburn", {
          protocol: {
            ...base.protocol,
            rule_ids: [...base.protocol.rule_ids, arrayRule.rule_id],
          },
          consultationState: {
            session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
            tenant_id: "demo",
            sequence: 1,
            pack_id: syntheticPack.packId,
            answered_slots: {
              "eligibility.test.contraindications": answer,
            },
            asked_slots: [],
            topics: [],
            pending_question_slot: null,
            active_protocol_id: base.protocol.protocol_id,
            active_intent: "heartburn",
            last_decision_status: "ask" as const,
            updated_at: "2026-07-13T00:00:00Z",
          },
          knowledge: {
            ...knowledge,
            protocolRules: [...syntheticProtocolRules, arrayRule],
          },
        }),
      );

    expect(withAnswer("pregnancyXno").status).toBe("recommend");
    expect(withAnswer("pregnancy.no").status).toBe("insufficient");
    expect(withAnswer("allergy present").status).toBe("insufficient");
  });

  it("uses the current customer wording to satisfy a data-driven question rule", () => {
    const base = request("cough");
    const sourceRule = syntheticProtocolRules.find(
      (rule) => rule.protocol_id === base.protocol.protocol_id,
    );
    if (!sourceRule) throw new Error("cough rule fixture missing");
    const questionRule = {
      ...sourceRule,
      rule_id: "RUL-SYN-COUGH-PATTERN-QUESTION",
      kind: "required_slot" as const,
      effect: "ask" as const,
      field: "symptom.cough_pattern",
      operator: "matches" as const,
      value: ["마른기침", "가래"],
      option_ids: [],
      question: "마른기침인가요, 가래가 있나요?",
      priority: 0,
    };
    const protocolWithQuestion = {
      ...base.protocol,
      rule_ids: [...base.protocol.rule_ids, questionRule.rule_id],
    };
    const knowledgeWithQuestion = {
      ...knowledge,
      protocolRules: [...syntheticProtocolRules, questionRule],
    };

    expect(
      nextProtocolQuestion({
        ...base,
        protocol: protocolWithQuestion,
        knowledge: knowledgeWithQuestion,
        normalized: normalized("마른기침이 나요"),
      })?.ruleId,
    ).not.toBe(questionRule.rule_id);
    expect(
      nextProtocolQuestion({
        ...base,
        protocol: protocolWithQuestion,
        knowledge: knowledgeWithQuestion,
        normalized: normalized("기침이 나요"),
      })?.slot,
    ).toBe("symptom.cough_pattern");
  });

  it("does not ask the same choice-changing slot twice", () => {
    const state: ConsultationState = {
      session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
      tenant_id: "demo",
      sequence: 1,
      pack_id: syntheticPack.packId,
      answered_slots: {},
      asked_slots: ["duration"],
      topics: [],
      pending_question_slot: "duration",
      active_protocol_id: "PTC-SYN-COUGH",
      active_intent: "cough_general",
      last_decision_status: "ask",
      updated_at: "2026-07-13T00:00:00Z",
    };
    const decision = buildRecommendationDecision(
      request("cough", {
        sequence: 2,
        normalized: normalized("모르겠어요"),
        consultationState: state,
      }),
    );
    expect(decision.status).toBe("insufficient");
    expect(decision.question).toBeNull();
    expect(decision.reason_codes).toContain("QUESTION_ALREADY_ASKED");
  });

  it("persists only structured consultation state", () => {
    const decision = buildRecommendationDecision(
      request("cough", { normalized: normalized("기침이 나요") }),
    );
    const state = nextConsultationState(undefined, {
      sessionId: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
      tenantId: "demo",
      sequence: 1,
      packId: syntheticPack.packId,
      protocolId: "PTC-SYN-COUGH",
      intent: "cough_general",
      decision,
      now: new Date("2026-07-13T00:00:00Z"),
    });
    expect(state.pending_question_slot).toBe("duration");
    expect(state.asked_slots).toEqual(["duration"]);
    expect(JSON.stringify(state)).not.toContain("기침이 나요");
  });
});
