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
    const decision = buildRecommendationDecision(
      request("heartburn", {
        knowledge: {
          ...knowledge,
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

  it("does not ask the same choice-changing slot twice", () => {
    const state: ConsultationState = {
      session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
      tenant_id: "demo",
      sequence: 1,
      pack_id: syntheticPack.packId,
      answered_slots: {},
      asked_slots: ["duration"],
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
