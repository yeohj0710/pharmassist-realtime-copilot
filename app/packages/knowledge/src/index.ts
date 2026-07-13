import { PharmassistError } from "@pharmassist/domain";

export interface PublicationRecord {
  readonly id: string;
  readonly domain: string;
  readonly trustTier: "A" | "B" | "C" | "D" | "X";
  readonly locator: string;
  readonly approved: boolean;
  readonly medicalSafetyApproved: boolean;
  readonly expiresAt: string;
  readonly conflicted: boolean;
  readonly synthetic: boolean;
}
export function lintForPublication(
  records: readonly PublicationRecord[],
  profile: "local-demo" | "production",
  now = new Date(),
): readonly string[] {
  const errors: string[] = [];
  for (const item of records) {
    if (item.domain !== "human_otc") errors.push(`${item.id}:DOMAIN_LEAK`);
    if (!item.locator || /placeholder|replace_with/iu.test(item.locator))
      errors.push(`${item.id}:LOCATOR_INVALID`);
    if (!item.approved || !item.medicalSafetyApproved)
      errors.push(`${item.id}:APPROVAL_MISSING`);
    if (item.conflicted) errors.push(`${item.id}:CONFLICTED`);
    if (new Date(item.expiresAt) <= now) errors.push(`${item.id}:EXPIRED`);
    if (
      profile === "production" &&
      (item.synthetic || !["A", "B"].includes(item.trustTier))
    )
      errors.push(`${item.id}:PRODUCTION_POLICY`);
  }
  return errors;
}

import type {
  ClinicalClaim,
  DrugProduct,
  Ingredient,
  OTCProtocol,
  ProductIngredient,
  ProtocolOption,
  ProtocolRule,
  SourceSnapshot,
} from "@pharmassist/contracts";

export interface DecisionPackEntities {
  readonly packId: string;
  readonly version: string;
  readonly synthetic: boolean;
  readonly clinicalUseProhibited: boolean;
  readonly verified: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly sources: readonly SourceSnapshot[];
  readonly ingredients: readonly Ingredient[];
  readonly products: readonly DrugProduct[];
  readonly productIngredients: readonly ProductIngredient[];
  readonly claims: readonly ClinicalClaim[];
  readonly protocols: readonly OTCProtocol[];
  readonly protocolOptions: readonly ProtocolOption[];
  readonly protocolRules: readonly ProtocolRule[];
}

export interface DecisionPackCounts {
  readonly sources: number;
  readonly ingredients: number;
  readonly products: number;
  readonly productIngredients: number;
  readonly claims: number;
  readonly protocols: number;
  readonly protocolOptions: number;
  readonly protocolRules: number;
}

export function decisionPackCounts(
  pack: DecisionPackEntities,
): DecisionPackCounts {
  return {
    sources: pack.sources.length,
    ingredients: pack.ingredients.length,
    products: pack.products.length,
    productIngredients: pack.productIngredients.length,
    claims: pack.claims.length,
    protocols: pack.protocols.length,
    protocolOptions: pack.protocolOptions.length,
    protocolRules: pack.protocolRules.length,
  };
}

const activeReviewForPack = (
  review: Readonly<{
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    expires_at?: string | null;
  }>,
  now: Date,
): boolean =>
  review.pharmacist_approved &&
  review.official_source_verified &&
  (!review.expires_at || new Date(review.expires_at) > now);

interface PackSourceRef {
  readonly claim_id: string;
  readonly source_id: string;
  readonly source_snapshot_id: string;
  readonly locator: string;
  readonly verified_at: string;
}

function checkSourceRefs(
  entityId: string,
  refs: readonly PackSourceRef[],
  sourceIds: ReadonlySet<string>,
  snapshotIds: ReadonlySet<string>,
  errors: string[],
): void {
  if (refs.length === 0) errors.push(`${entityId}:SOURCE_REF_MISSING`);
  for (const ref of refs) {
    if (!sourceIds.has(ref.source_id))
      errors.push(`${entityId}:SOURCE_UNKNOWN:${ref.source_id}`);
    if (!snapshotIds.has(ref.source_snapshot_id))
      errors.push(`${entityId}:SNAPSHOT_UNKNOWN:${ref.source_snapshot_id}`);
    if (!ref.locator) errors.push(`${entityId}:LOCATOR_MISSING`);
  }
}

/**
 * Enforces the source → claim → protocol → review → compile boundary. Automatic
 * extraction can enter a candidate pack, but only reviewed/published entities
 * can be activated in production.
 */
export function lintDecisionPack(
  pack: DecisionPackEntities,
  profile: "local-demo" | "staging" | "production",
  now = new Date(),
): readonly string[] {
  const errors: string[] = [];
  const sourceIds = new Set(pack.sources.map((item) => item.source_id));
  const snapshotIds = new Set(
    pack.sources.map((item) => item.source_snapshot_id),
  );
  const ingredientIds = new Set(
    pack.ingredients.map((item) => item.ingredient_id),
  );
  const productIds = new Set(pack.products.map((item) => item.product_id));
  const claimIds = new Set(pack.claims.map((item) => item.claim_id));
  const optionIds = new Set(pack.protocolOptions.map((item) => item.option_id));
  const ruleIds = new Set(pack.protocolRules.map((item) => item.rule_id));

  if (!pack.packId) errors.push("PACK_ID_MISSING");
  if (new Date(pack.expiresAt) <= now) errors.push("PACK_EXPIRED");
  if (profile === "production") {
    if (pack.synthetic) errors.push("PACK_SYNTHETIC");
    if (pack.clinicalUseProhibited) errors.push("PACK_CLINICAL_USE_PROHIBITED");
    if (!pack.verified) errors.push("PACK_NOT_VERIFIED");
  }

  for (const source of pack.sources) {
    if (profile === "production" && !source.official)
      errors.push(`${source.source_snapshot_id}:NON_OFFICIAL_SOURCE`);
    if (source.status !== "parsed")
      errors.push(`${source.source_snapshot_id}:SOURCE_NOT_PARSED`);
    if (
      source.usage_rights === "unknown" ||
      (profile === "production" && source.usage_rights === "contract_required")
    )
      errors.push(`${source.source_snapshot_id}:USAGE_RIGHTS_UNRESOLVED`);
    if (
      profile === "production" &&
      [
        source.commercial_use,
        source.cache_policy,
        source.redistribution,
        source.ai_context_use,
      ].some((value) => value !== "allowed")
    )
      errors.push(`${source.source_snapshot_id}:SOURCE_RIGHTS_BLOCK`);
  }

  for (const ingredient of pack.ingredients) {
    checkSourceRefs(
      ingredient.ingredient_id,
      ingredient.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (
      profile === "production" &&
      (!activeReviewForPack(ingredient.review, now) ||
        ingredient.status !== "active")
    )
      errors.push(`${ingredient.ingredient_id}:INGREDIENT_NOT_PUBLISHABLE`);
  }

  for (const product of pack.products) {
    checkSourceRefs(
      product.product_id,
      product.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (profile === "production" && product.otc_status !== "otc")
      errors.push(`${product.product_id}:NOT_OTC`);
    if (
      profile === "production" &&
      (product.status !== "active" || product.supply_performance === false)
    )
      errors.push(`${product.product_id}:PRODUCT_INACTIVE`);
  }

  for (const link of pack.productIngredients) {
    if (!productIds.has(link.product_id))
      errors.push(`${link.product_ingredient_id}:PRODUCT_UNKNOWN`);
    if (!ingredientIds.has(link.ingredient_id))
      errors.push(`${link.product_ingredient_id}:INGREDIENT_UNKNOWN`);
    checkSourceRefs(
      link.product_ingredient_id,
      link.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
  }

  for (const claim of pack.claims) {
    if (claim.pack_id !== pack.packId)
      errors.push(`${claim.claim_id}:PACK_ID_MISMATCH`);
    checkSourceRefs(
      claim.claim_id,
      claim.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (
      profile === "production" &&
      (claim.status !== "published" || !activeReviewForPack(claim.review, now))
    )
      errors.push(`${claim.claim_id}:CLAIM_NOT_PUBLISHED`);
  }

  for (const protocol of pack.protocols) {
    if (protocol.pack_id !== pack.packId)
      errors.push(`${protocol.protocol_id}:PACK_ID_MISMATCH`);
    if (new Date(protocol.expires_at) <= now)
      errors.push(`${protocol.protocol_id}:PROTOCOL_EXPIRED`);
    for (const id of protocol.option_ids)
      if (!optionIds.has(id))
        errors.push(`${protocol.protocol_id}:OPTION_UNKNOWN:${id}`);
    for (const id of protocol.rule_ids)
      if (!ruleIds.has(id))
        errors.push(`${protocol.protocol_id}:RULE_UNKNOWN:${id}`);
    checkSourceRefs(
      protocol.protocol_id,
      protocol.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (
      profile === "production" &&
      (protocol.status !== "published" ||
        !activeReviewForPack(protocol.review, now))
    )
      errors.push(`${protocol.protocol_id}:PROTOCOL_NOT_PUBLISHED`);
  }

  for (const option of pack.protocolOptions) {
    if (!ingredientIds.has(option.ingredient_id))
      errors.push(`${option.option_id}:INGREDIENT_UNKNOWN`);
    for (const id of option.claim_ids)
      if (!claimIds.has(id))
        errors.push(`${option.option_id}:CLAIM_UNKNOWN:${id}`);
    checkSourceRefs(
      option.option_id,
      option.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (
      profile === "production" &&
      (option.status !== "published" ||
        !activeReviewForPack(option.review, now))
    )
      errors.push(`${option.option_id}:OPTION_NOT_PUBLISHED`);
  }

  for (const rule of pack.protocolRules) {
    checkSourceRefs(
      rule.rule_id,
      rule.source_refs,
      sourceIds,
      snapshotIds,
      errors,
    );
    if (
      profile === "production" &&
      (rule.status !== "published" || !activeReviewForPack(rule.review, now))
    )
      errors.push(`${rule.rule_id}:RULE_NOT_PUBLISHED`);
  }
  return errors;
}

export function compileDecisionPack<T extends DecisionPackEntities>(
  authoring: T,
  profile: "local-demo" | "staging" | "production",
  now = new Date(),
): T {
  const errors = lintDecisionPack(authoring, profile, now);
  if (errors.length > 0)
    throw new PharmassistError(
      "KNOWLEDGE_STALE",
      `Knowledge pack failed compile gates: ${errors.join(",")}`,
      false,
      "previous_pack",
    );
  return {
    ...authoring,
    sources: [...authoring.sources].sort((a, b) =>
      a.source_snapshot_id.localeCompare(b.source_snapshot_id),
    ),
    ingredients: [...authoring.ingredients].sort((a, b) =>
      a.ingredient_id.localeCompare(b.ingredient_id),
    ),
    products: [...authoring.products].sort((a, b) =>
      a.product_id.localeCompare(b.product_id),
    ),
    productIngredients: [...authoring.productIngredients].sort((a, b) =>
      a.product_ingredient_id.localeCompare(b.product_ingredient_id),
    ),
    claims: [...authoring.claims].sort((a, b) =>
      a.claim_id.localeCompare(b.claim_id),
    ),
    protocols: [...authoring.protocols].sort((a, b) =>
      a.protocol_id.localeCompare(b.protocol_id),
    ),
    protocolOptions: [...authoring.protocolOptions].sort((a, b) =>
      a.option_id.localeCompare(b.option_id),
    ),
    protocolRules: [...authoring.protocolRules].sort((a, b) =>
      a.rule_id.localeCompare(b.rule_id),
    ),
  };
}
