import type { TenantFormulary } from "@pharmassist/contracts";
import type { RuntimePack } from "@pharmassist/runtime";

export function buildResearchPreviewFormulary(
  previewPack: RuntimePack,
): TenantFormulary {
  const protocolByOption = new Map(
    previewPack.protocols.flatMap((protocol) =>
      protocol.option_ids.map((optionId) => [optionId, protocol] as const),
    ),
  );
  const claimById = new Map(
    previewPack.claims.map((claim) => [claim.claim_id, claim] as const),
  );
  const productById = new Map(
    previewPack.products.map(
      (product) => [product.product_id, product] as const,
    ),
  );
  const entries = previewPack.protocolOptions.flatMap((option) => {
    const protocol = protocolByOption.get(option.option_id);
    if (!protocol) return [];
    const supportedProductIds = new Set(
      option.claim_ids.flatMap((claimId) => {
        const claim = claimById.get(claimId);
        if (
          claim?.claim_type !== "indication" ||
          claim.status !== "published" ||
          typeof claim.object !== "object" ||
          claim.object === null ||
          Array.isArray(claim.object)
        )
          return [];
        const candidateIds = (claim.object as Record<string, unknown>)[
          "candidate_product_ids"
        ];
        return Array.isArray(candidateIds)
          ? candidateIds.filter(
              (candidate): candidate is string => typeof candidate === "string",
            )
          : [];
      }),
    );
    return [...supportedProductIds].flatMap((productId) => {
      const product = productById.get(productId);
      const link = previewPack.productIngredients.find(
        (candidate) =>
          candidate.product_id === productId &&
          candidate.ingredient_id === option.ingredient_id &&
          candidate.is_active &&
          candidate.role !== "excipient",
      );
      return product?.status === "active" &&
        product.otc_status === "otc" &&
        link
        ? [
            {
              product_id: productId,
              ingredient_id: option.ingredient_id,
              symptom_category: protocol.symptom_category,
              active: true,
              pharmacist_approved: false,
              preferred: option.therapeutic_role === "preferred",
              notes: "공식 제품 단위 효능 근거가 연결된 연구 미리보기 후보",
            },
          ]
        : [];
    });
  });
  const importedEntries = previewPack.products.flatMap((product) => {
    if (
      !product.product_id.startsWith("PRD-HEALTHKR-") ||
      product.official_match_status !== "confirmed" ||
      product.permit_cancelled === true ||
      product.status !== "active" ||
      product.otc_status !== "otc" ||
      !product.protocol_ids?.length
    )
      return [];
    return product.protocol_ids.flatMap((protocolId) => {
      const protocol = previewPack.protocols.find(
        (candidate) => candidate.protocol_id === protocolId,
      );
      if (!protocol) return [];
      return previewPack.protocolOptions.flatMap((option) =>
        option.protocol_id === protocolId &&
        protocol.option_ids.includes(option.option_id) &&
        previewPack.productIngredients.some(
          (link) =>
            link.product_id === product.product_id &&
            link.ingredient_id === option.ingredient_id &&
            link.is_active &&
            link.role !== "excipient",
        )
          ? [
              {
                product_id: product.product_id,
                ingredient_id: option.ingredient_id,
                symptom_category: protocol.symptom_category,
                active: true,
                pharmacist_approved: false,
                preferred: option.therapeutic_role === "preferred",
                notes:
                  "약학정보원 confirmed 연결과 결정론적 적응증·성분 매핑을 통과한 연구 미리보기 후보; 약사 검토 전",
              },
            ]
          : [],
      );
    });
  });
  const seenEntryKeys = new Set<string>();

  return {
    formulary_id: "FRM-ACTUAL-RESEARCH-PREVIEW",
    tenant_id: "local-research-preview",
    pack_id: previewPack.packId,
    version: "1",
    status: "active",
    coverage_target: 0.85,
    effective_from: "2026-07-14T00:00:00+09:00",
    entries: [...entries, ...importedEntries].filter((entry) => {
      const key = `${entry.product_id}|${entry.ingredient_id}|${entry.symptom_category}`;
      if (seenEntryKeys.has(key)) return false;
      seenEntryKeys.add(key);
      return true;
    }),
    review: {
      pharmacist_approved: false,
      official_source_verified: true,
      reviewer_ids: [],
      reviewed_at: null,
      expires_at: previewPack.expiresAt,
      notes:
        "로컬 공식 연결 연구 미리보기 전용. confirmed 연결은 확인했지만 실제 약사 승인과 운영 승격은 완료되지 않았습니다.",
    },
  };
}
