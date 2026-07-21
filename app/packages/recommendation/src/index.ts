import type {
  ClinicalClaim,
  ConsultationState,
  DrugProduct,
  Ingredient,
  OTCProtocol,
  ProductIngredient,
  ProtocolOption,
  ProtocolRule,
  RecommendationDecision,
  TenantFormulary,
  TenantInventory,
  TenantSalesAggregate,
} from "@pharmassist/contracts";
import { renderQuestionTemplate } from "@pharmassist/dialogue";
import type { NormalizedInput, SafetyDecision } from "@pharmassist/domain";
import { matchesProductProtocolProfile } from "@pharmassist/domain";

export interface RecommendationKnowledge {
  readonly packId: string;
  readonly sourceSnapshotIds: ReadonlySet<string>;
  readonly ingredients: readonly Ingredient[];
  readonly products: readonly DrugProduct[];
  readonly productIngredients: readonly ProductIngredient[];
  readonly claims: readonly ClinicalClaim[];
  readonly protocolOptions: readonly ProtocolOption[];
  readonly protocolRules: readonly ProtocolRule[];
}

export interface TenantRecommendationContext {
  readonly tenantId: string;
  readonly formulary?: TenantFormulary;
  /** `undefined` means that no inventory integration is configured. */
  readonly inventory?: readonly TenantInventory[];
  readonly sales?: readonly TenantSalesAggregate[];
}

export interface RecommendationRequest {
  readonly sequence: number;
  readonly sessionId: string;
  readonly now: Date;
  readonly normalized: NormalizedInput;
  readonly safety: SafetyDecision;
  readonly protocol?: OTCProtocol;
  readonly knowledge: RecommendationKnowledge;
  readonly tenant: TenantRecommendationContext;
  readonly consultationState?: ConsultationState;
  /** Local research-preview UI may retain candidates while asking one question. */
  readonly allowProgressiveCandidates?: boolean;
}

type SourceRef = RecommendationDecision["source_refs"][number];

const sourceKey = (ref: SourceRef): string =>
  `${ref.claim_id}|${ref.source_id}|${ref.source_snapshot_id}|${ref.locator}`;

const uniqueSourceRefs = (refs: readonly SourceRef[]): SourceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = sourceKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const activeReview = (
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

const usableReview = (
  review: Readonly<{
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    expires_at?: string | null;
  }>,
  request: RecommendationRequest,
): boolean =>
  activeReview(review, request.now) ||
  (request.allowProgressiveCandidates === true &&
    request.knowledge.packId.startsWith("PACK-PHARMASSIST-KR-OTC-ACTUAL-") &&
    review.official_source_verified &&
    (!review.expires_at || new Date(review.expires_at) > request.now));

const activeSourceRefs = (
  refs: readonly SourceRef[],
  sourceSnapshotIds: ReadonlySet<string>,
): refs is readonly [SourceRef, ...SourceRef[]] =>
  refs.length > 0 &&
  refs.every(
    (ref) =>
      Boolean(ref.claim_id && ref.source_id && ref.locator) &&
      sourceSnapshotIds.has(ref.source_snapshot_id),
  );

const decisionId = (
  sessionId: string,
  sequence: number,
  protocolId?: string,
): string =>
  `DEC-${sessionId.replaceAll("-", "").toUpperCase()}-${sequence}${protocolId ? `-${protocolId}` : ""}`;

const noDecision = (
  request: RecommendationRequest,
  reasonCodes: readonly string[],
  protocol: OTCProtocol | undefined = request.protocol,
): RecommendationDecision => ({
  decision_id: decisionId(
    request.sessionId,
    request.sequence,
    protocol?.protocol_id,
  ),
  status: "insufficient",
  pack_id: request.knowledge.packId,
  protocol_id: protocol?.protocol_id ?? null,
  intent: protocol?.intent ?? null,
  tenant_inventory_connected: request.tenant.inventory !== undefined,
  ingredient_options: [],
  product_candidates: [],
  question: null,
  referral: null,
  source_refs: [],
  reason_codes: [...reasonCodes] as RecommendationDecision["reason_codes"],
});

const askDecision = (
  request: RecommendationRequest,
  question: Readonly<{ question: string; reason: string; slot: string }>,
  reasonCode: string,
  protocol: OTCProtocol | undefined = request.protocol,
): RecommendationDecision => ({
  ...noDecision(request, [reasonCode], protocol),
  status: "ask",
  question,
});

const referralUrgency = (
  safety: SafetyDecision,
): NonNullable<RecommendationDecision["referral"]>["urgency"] => {
  const action = safety.redFlags.find(
    (flag) => flag.matched && !flag.negated,
  )?.action;
  return action === "emergency"
    ? "emergency"
    : action === "same_day"
      ? "same_day"
      : action === "doctor"
        ? "doctor"
        : "pharmacist_review";
};

const referDecision = (
  request: RecommendationRequest,
): RecommendationDecision => ({
  ...noDecision(request, ["SAFETY_GATE_REFER"]),
  status: "refer",
  referral: {
    urgency: referralUrgency(request.safety),
    reason:
      request.safety.redFlags.find((flag) => flag.matched && !flag.negated)
        ?.label ?? "일반의약품 추천보다 추가 평가가 우선입니다.",
    action:
      request.safety.sayNow[0] ??
      "제품 후보를 제시하지 말고 의료진 또는 약사의 직접 평가를 받으세요.",
  },
});

const slotName = (field: string): string =>
  field.startsWith("slot.") ? field.slice("slot.".length) : field;

const renderedQuestion = (
  question: string,
  request: RecommendationRequest,
): string =>
  renderQuestionTemplate(question, {
    slots: request.normalized.slots,
    ...(request.consultationState
      ? { answeredSlots: request.consultationState.answered_slots }
      : {}),
  });

const fieldValue = (
  rule: ProtocolRule,
  request: RecommendationRequest,
): unknown => {
  if (rule.field === "normalized_text")
    return request.normalized.normalizedText;
  const name = slotName(rule.field);
  const persisted = request.consultationState?.answered_slots[name];
  if (persisted !== undefined) return persisted;
  const current = request.normalized.slots[name]?.value;
  if (current !== undefined) return current;
  if (
    rule.operator === "matches" &&
    (rule.kind === "required_slot" || rule.kind === "selection_pattern")
  )
    return request.normalized.normalizedText;
  return undefined;
};

const ruleMatches = (
  rule: ProtocolRule,
  request: RecommendationRequest,
): boolean => {
  const actual = fieldValue(rule, request);
  switch (rule.operator) {
    case "present":
      return (
        actual !== undefined && actual !== null && String(actual).length > 0
      );
    case "absent":
      return (
        actual === undefined || actual === null || String(actual).length === 0
      );
    case "equals":
      return actual === rule.value;
    case "one_of":
      return Array.isArray(rule.value) && rule.value.includes(actual);
    case "matches":
    case "not_matches": {
      const patterns =
        typeof rule.value === "string"
          ? [rule.value]
          : Array.isArray(rule.value)
            ? rule.value
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
            : [];
      const matched = patterns.some((pattern) => {
        try {
          return new RegExp(pattern, "iu").test(String(actual ?? ""));
        } catch {
          return false;
        }
      });
      return rule.operator === "matches" ? matched : !matched;
    }
  }
};

const verifiedProtocol = (
  protocol: OTCProtocol,
  request: RecommendationRequest,
): boolean =>
  protocol.pack_id === request.knowledge.packId &&
  protocol.domain === "human_otc" &&
  protocol.status === "published" &&
  new Date(protocol.expires_at) > request.now &&
  usableReview(protocol.review, request) &&
  activeSourceRefs(protocol.source_refs, request.knowledge.sourceSnapshotIds);

const verifiedClaimsForOption = (
  option: ProtocolOption,
  request: RecommendationRequest,
): readonly ClinicalClaim[] => {
  const byId = new Map(
    request.knowledge.claims.map((claim) => [claim.claim_id, claim] as const),
  );
  const claims = option.claim_ids
    .map((claimId) => byId.get(claimId))
    .filter((claim): claim is ClinicalClaim => Boolean(claim));
  if (
    claims.length !== option.claim_ids.length ||
    claims.some(
      (claim) =>
        claim.pack_id !== request.knowledge.packId ||
        claim.status !== "published" ||
        !usableReview(claim.review, request) ||
        !activeSourceRefs(
          claim.source_refs,
          request.knowledge.sourceSnapshotIds,
        ),
    )
  )
    return [];
  return claims;
};

interface VerifiedOption {
  readonly option: ProtocolOption;
  readonly ingredient: Ingredient;
  readonly claims: readonly ClinicalClaim[];
}

const verifiedOptions = (
  protocol: OTCProtocol,
  request: RecommendationRequest,
): readonly VerifiedOption[] => {
  const ingredientById = new Map(
    request.knowledge.ingredients.map(
      (item) => [item.ingredient_id, item] as const,
    ),
  );
  return request.knowledge.protocolOptions
    .filter(
      (option) =>
        protocol.option_ids.includes(option.option_id) &&
        option.protocol_id === protocol.protocol_id &&
        option.status === "published" &&
        usableReview(option.review, request) &&
        activeSourceRefs(
          option.source_refs,
          request.knowledge.sourceSnapshotIds,
        ),
    )
    .map((option): VerifiedOption | undefined => {
      const ingredient = ingredientById.get(option.ingredient_id);
      const claims = verifiedClaimsForOption(option, request);
      if (
        !ingredient ||
        ingredient.status !== "active" ||
        !usableReview(ingredient.review, request) ||
        !activeSourceRefs(
          ingredient.source_refs,
          request.knowledge.sourceSnapshotIds,
        ) ||
        claims.length === 0
      )
        return undefined;
      return { option, ingredient, claims };
    })
    .filter((item): item is VerifiedOption => Boolean(item));
};

const rulesFor = (
  protocol: OTCProtocol,
  request: RecommendationRequest,
): readonly ProtocolRule[] =>
  request.knowledge.protocolRules
    .filter(
      (rule) =>
        protocol.rule_ids.includes(rule.rule_id) &&
        rule.protocol_id === protocol.protocol_id &&
        rule.status === "published" &&
        usableReview(rule.review, request) &&
        activeSourceRefs(rule.source_refs, request.knowledge.sourceSnapshotIds),
    )
    .sort((left, right) => left.priority - right.priority);

export interface ProgressiveQuestion {
  readonly question: string;
  readonly reason: string;
  readonly slot: string;
  readonly ruleId: string;
}

export function nextProtocolQuestion(
  request: RecommendationRequest,
): ProgressiveQuestion | null {
  const protocol = request.protocol;
  if (!protocol || !verifiedProtocol(protocol, request)) return null;
  const asked = new Set(request.consultationState?.asked_slots ?? []);
  const rule = rulesFor(protocol, request)
    .filter((item) => item.effect === "ask" && item.question)
    .filter((item) => !ruleMatches(item, request))
    .find((item) => !asked.has(slotName(item.field)));
  return rule?.question
    ? {
        question: renderedQuestion(rule.question, request),
        reason: rule.reason,
        slot: slotName(rule.field),
        ruleId: rule.rule_id,
      }
    : null;
}

const sourceRefsFor = (verified: VerifiedOption): readonly SourceRef[] =>
  uniqueSourceRefs([
    ...verified.option.source_refs,
    ...verified.ingredient.source_refs,
    ...verified.claims.flatMap((claim) => claim.source_refs),
  ]);

type RecommendationDrugProduct = DrugProduct &
  Readonly<{
    official_match_status?:
      "confirmed" | "review_required" | "not_found" | "not_applicable";
    official_product_key?: string;
    official_source_url?: string;
    retail_offer?: Readonly<{
      sku_id: string;
      display_name: string;
      specification: string;
      displayed_price_krw: number;
      recorded_at: string;
      price_status: string;
      image_url?: string | null;
      image_source_url?: string | null;
      image_rights_status?: string | null;
      image_kind?: string | null;
      image_checked_at?: string | null;
    }>;
    protocol_ids?: readonly string[];
    pathway_profiles?: readonly Readonly<{
      protocol_id: string;
      mechanisms: readonly string[];
      combination_role: "primary" | "supportive";
      compatible_roles: readonly string[];
      score: number;
      source: string;
    }>[];
    clinical_group_key?: string;
    indication_summary?: string;
    dosage_summary?: string;
    precaution_summary?: string;
    interactions?: readonly string[];
    permit_cancelled?: boolean;
  }>;

interface RankedProduct {
  readonly product: RecommendationDrugProduct;
  readonly ingredientId: string;
  readonly option: ProtocolOption;
  readonly sourceRefs: readonly SourceRef[];
  readonly clinicalGroupKey: string;
  readonly pendingSafetySlots: readonly CandidateSafetySlot[];
  /** -1 fits the current age context best, 1 fits it worst, 0 is neutral. */
  readonly ageScopeRank: number;
  readonly sameGroupProductCount?: number;
  readonly inventory?: TenantInventory;
  readonly sales?: TenantSalesAggregate;
}

type CandidateSafetySlot = "age_years" | "pregnancy_status";

type CandidateSafetyAssessment =
  | Readonly<{ status: "eligible"; pendingSlots: readonly [] }>
  | Readonly<{
      status: "requires_context";
      pendingSlots: readonly CandidateSafetySlot[];
    }>
  | Readonly<{ status: "ineligible"; pendingSlots: readonly [] }>;

const therapeuticRolePriority = {
  preferred: 3,
  alternative: 2,
  conditional: 1,
} as const;

const evidenceScopePriority = {
  direct: 3,
  phenotype_specific: 2,
  supportive: 1,
} as const;

const compareProtocolOptions = (
  left: ProtocolOption,
  right: ProtocolOption,
): number => {
  const structuredFit =
    left.therapeutic_role !== undefined ||
    right.therapeutic_role !== undefined ||
    left.evidence_scope !== undefined ||
    right.evidence_scope !== undefined;
  if (structuredFit) {
    const therapeuticRole =
      (therapeuticRolePriority[right.therapeutic_role ?? "conditional"] ?? 0) -
      (therapeuticRolePriority[left.therapeutic_role ?? "conditional"] ?? 0);
    if (therapeuticRole) return therapeuticRole;
    const evidenceScope =
      (evidenceScopePriority[right.evidence_scope ?? "supportive"] ?? 0) -
      (evidenceScopePriority[left.evidence_scope ?? "supportive"] ?? 0);
    if (evidenceScope) return evidenceScope;
  }
  return (
    right.safety_priority - left.safety_priority ||
    right.clinical_priority - left.clinical_priority ||
    left.option_id.localeCompare(right.option_id)
  );
};

const explicitlySupportedProductIds = (
  verified: VerifiedOption,
): ReadonlySet<string> =>
  new Set(
    verified.claims.flatMap((claim) => {
      if (
        claim.claim_type !== "indication" ||
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

const asRecommendationProduct = (
  product: DrugProduct,
): RecommendationDrugProduct => product as RecommendationDrugProduct;

const isHealthKrImported = (product: RecommendationDrugProduct): boolean =>
  product.product_id.startsWith("PRD-HEALTHKR-");

const confirmedImportedProduct = (
  product: RecommendationDrugProduct,
  protocol: OTCProtocol,
): boolean =>
  isHealthKrImported(product) &&
  product.official_match_status === "confirmed" &&
  Boolean(product.official_product_key) &&
  product.permit_cancelled !== true &&
  product.protocol_ids?.includes(protocol.protocol_id) === true &&
  (product.pathway_profiles?.some(
    (profile) =>
      profile.protocol_id === protocol.protocol_id &&
      profile.mechanisms.length > 0 &&
      profile.score > 0,
  ) === true ||
    (product.pathway_profiles === undefined &&
      matchesProductProtocolProfile(
        protocol.protocol_id,
        product.indication_summary,
        product.route,
        product.dosage_form,
      )));

const normalizedTerm = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");

const stringValues = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];

const termsOverlap = (
  leftValues: readonly string[],
  rightValues: readonly string[],
): boolean =>
  leftValues.some((leftValue) => {
    const left = normalizedTerm(leftValue);
    if (left.length < 2) return false;
    return rightValues.some((rightValue) => {
      const right = normalizedTerm(rightValue);
      return (
        right.length >= 2 &&
        (left === right || left.includes(right) || right.includes(left))
      );
    });
  });

const numericSlot = (
  request: RecommendationRequest,
  slot: string,
): number | undefined => {
  const value = request.normalized.slots[slot]?.value;
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

const ageRestrictionApplies = (description: string, age: number): boolean => {
  for (const match of description.matchAll(
    /(?:만\s*)?(\d+(?:\.\d+)?)\s*개월\s*(미만|이하|초과|이상)/gu,
  )) {
    const boundary = Number(match[1]) / 12;
    switch (match[2]) {
      case "미만":
        if (age < boundary) return true;
        break;
      case "이하":
        if (age <= boundary) return true;
        break;
      case "초과":
        if (age > boundary) return true;
        break;
      case "이상":
        if (age >= boundary) return true;
        break;
    }
  }
  const range = description.match(
    /(?:만\s*)?(\d+(?:\.\d+)?)\s*세\s*(?:이상|부터)\s*(\d+(?:\.\d+)?)\s*세\s*(?:이하|까지)/u,
  );
  if (range?.[1] && range[2])
    return age >= Number(range[1]) && age <= Number(range[2]);

  for (const match of description.matchAll(
    /(?:만\s*)?(\d+(?:\.\d+)?)\s*세\s*(미만|이하|초과|이상)/gu,
  )) {
    const boundary = Number(match[1]);
    switch (match[2]) {
      case "미만":
        if (age < boundary) return true;
        break;
      case "이하":
        if (age <= boundary) return true;
        break;
      case "초과":
        if (age > boundary) return true;
        break;
      case "이상":
        if (age >= boundary) return true;
        break;
    }
  }
  if (/신생아/u.test(description)) return age < 1 / 12;
  if (/영아/u.test(description)) return age < 1;
  if (/소아|어린이/u.test(description)) return age < 18;
  return false;
};

const pediatricScopedProduct = (product: RecommendationDrugProduct): boolean =>
  /키즈|어린이|소아/u.test(
    `${product.display_name} ${product.retail_offer?.display_name ?? ""}`,
  ) ||
  (/소아|어린이/u.test(product.dosage_summary ?? "") &&
    !/성인/u.test(product.dosage_summary ?? ""));

const productSafetyAssessment = (
  product: RecommendationDrugProduct,
  verified: VerifiedOption,
  request: RecommendationRequest,
): CandidateSafetyAssessment => {
  const ineligible = (): CandidateSafetyAssessment => ({
    status: "ineligible",
    pendingSlots: [],
  });
  const pendingSlots = new Set<CandidateSafetySlot>();
  const ingredientTerms = [
    verified.ingredient.display_name_ko,
    ...(product.active_ingredients ?? []).map((item) => item.name),
  ];
  const productTerms = [
    product.display_name,
    ...(product.retail_offer ? [product.retail_offer.display_name] : []),
    ...ingredientTerms,
  ];
  const allergies = stringValues(request.normalized.slots["allergies"]?.value);
  if (termsOverlap(allergies, productTerms)) return ineligible();

  const currentProducts = stringValues(
    request.normalized.slots["current_products"]?.value,
  );
  if (termsOverlap(currentProducts, ingredientTerms)) return ineligible();
  if (
    currentProducts.some((currentProduct) =>
      (product.interactions ?? []).some((interaction) =>
        termsOverlap([currentProduct], [interaction]),
      ),
    )
  )
    return ineligible();

  const age = numericSlot(request, "age_years");
  const pediatricOnly = pediatricScopedProduct(product);
  if (pediatricOnly) {
    if (age === undefined) pendingSlots.add("age_years");
    else if (age >= 18) return ineligible();
  }
  const sexAtBirth = String(
    request.normalized.slots["sex_at_birth"]?.value ?? "",
  );
  const pregnancyStatus =
    sexAtBirth === "male"
      ? "not_pregnant"
      : String(
          request.normalized.slots["pregnancy_status"]?.value ?? "unknown",
        );
  // The registry currently has complete official text but only structured DUR
  // flags for restrictions that were explicitly present. In research preview,
  // missing age or pregnancy context must not make a newly imported product
  // look safer than a curated option with an explicit restriction.
  if (isHealthKrImported(product) && product.pathway_profiles?.length) {
    if (age === undefined) pendingSlots.add("age_years");
    if (!pregnancyStatus || pregnancyStatus === "unknown")
      pendingSlots.add("pregnancy_status");
  }
  const conditions = stringValues(
    request.normalized.slots["conditions"]?.value,
  );
  for (const flag of product.dur_flags ?? []) {
    if (flag.blocking === false) continue;
    switch (flag.type) {
      case "age":
        if (age === undefined) pendingSlots.add("age_years");
        else if (ageRestrictionApplies(flag.description, age))
          return ineligible();
        break;
      case "pregnancy":
        if (!pregnancyStatus || pregnancyStatus === "unknown")
          pendingSlots.add("pregnancy_status");
        else if (pregnancyStatus !== "not_pregnant") return ineligible();
        break;
      case "elderly":
        if (age === undefined) pendingSlots.add("age_years");
        else if (age >= 65) return ineligible();
        break;
      case "duplicate":
        if (
          termsOverlap(currentProducts, ingredientTerms) ||
          currentProducts.some((item) =>
            termsOverlap([item], [flag.description]),
          )
        )
          return ineligible();
        break;
      case "coadministration":
        if (
          currentProducts.some((item) =>
            termsOverlap([item], [flag.description]),
          )
        )
          return ineligible();
        break;
      case "other":
        if (
          flag.blocking === true &&
          (conditions.length === 0 ||
            conditions.some((item) => termsOverlap([item], [flag.description])))
        )
          return ineligible();
        break;
      case "dose":
      case "duration":
      case "split":
        // These restrictions constrain a regimen, not product eligibility.
        // The deterministic engine does not infer an unprovided regimen.
        break;
    }
  }
  return pendingSlots.size > 0
    ? { status: "requires_context", pendingSlots: [...pendingSlots] }
    : { status: "eligible", pendingSlots: [] };
};

const productClinicalGroupKey = (
  product: RecommendationDrugProduct,
  ingredientId: string,
): string => {
  if (product.clinical_group_key) return product.clinical_group_key;
  const ingredients = (product.active_ingredients ?? [])
    .map((item) => normalizedTerm(item.ingredient_id || item.name))
    .filter(Boolean)
    .toSorted()
    .join("+");
  return [
    ingredients || ingredientId,
    product.dosage_form ?? "unknown-form",
    product.route ?? "unknown-route",
  ].join("|");
};

const recentSalesForProtocol = (
  item: TenantSalesAggregate,
  protocol: OTCProtocol,
  request: RecommendationRequest,
): boolean => {
  if (item.symptom_category !== protocol.symptom_category) return false;
  const start = Date.parse(`${item.window_start}T00:00:00Z`);
  const end = Date.parse(`${item.window_end}T00:00:00Z`);
  const now = Date.UTC(
    request.now.getUTCFullYear(),
    request.now.getUTCMonth(),
    request.now.getUTCDate(),
  );
  const ninetyDays = 90 * 24 * 60 * 60 * 1_000;
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= end &&
    end <= now &&
    start >= now - ninetyDays
  );
};

const productPrice = (product: RecommendationDrugProduct): number =>
  product.retail_offer?.displayed_price_krw ?? Number.MAX_SAFE_INTEGER;

const rankedProducts = (
  options: readonly VerifiedOption[],
  protocol: OTCProtocol,
  request: RecommendationRequest,
): readonly RankedProduct[] => {
  const researchPreview = request.tenant.tenantId === "local-research-preview";
  const activeFormulary =
    request.tenant.formulary?.tenant_id === request.tenant.tenantId &&
    request.tenant.formulary.pack_id === request.knowledge.packId &&
    request.tenant.formulary.status === "active" &&
    (researchPreview ||
      activeReview(request.tenant.formulary.review, request.now))
      ? request.tenant.formulary
      : undefined;
  if (!activeFormulary) return [];

  const optionByIngredient = new Map(
    options.map((item) => [item.ingredient.ingredient_id, item] as const),
  );
  const productById = new Map(
    request.knowledge.products.map(
      (product) =>
        [product.product_id, asRecommendationProduct(product)] as const,
    ),
  );
  const inventoryByProduct = new Map(
    (request.tenant.inventory ?? [])
      .filter(
        (item) =>
          item.tenant_id === request.tenant.tenantId &&
          item.pack_id === request.knowledge.packId,
      )
      .map((item) => [item.product_id, item] as const),
  );
  const salesByProduct = new Map(
    (request.tenant.sales ?? [])
      .filter(
        (item) =>
          item.tenant_id === request.tenant.tenantId &&
          item.pack_id === request.knowledge.packId &&
          recentSalesForProtocol(item, protocol, request),
      )
      .map((item) => [item.product_id, item] as const),
  );
  const productIngredients = new Map<string, ProductIngredient[]>();
  for (const link of request.knowledge.productIngredients) {
    if (!link.is_active || link.role === "excipient") continue;
    productIngredients.set(link.product_id, [
      ...(productIngredients.get(link.product_id) ?? []),
      link,
    ]);
  }
  // Pediatric-labelled products fit a child consultation first and an unknown
  // or adult consultation last; ineligibility for a known adult age is still
  // decided by the safety assessment, this only orders otherwise-eligible
  // candidates by age context.
  const knownAge = numericSlot(request, "age_years");
  const childContext =
    request.normalized.personScope === "child" ||
    (knownAge !== undefined && knownAge < 18);
  const ageScopeRankFor = (product: RecommendationDrugProduct): number => {
    if (!pediatricScopedProduct(product)) return 0;
    if (childContext) return -1;
    return knownAge === undefined ? 1 : 0;
  };

  const ranked = activeFormulary.entries
    .filter(
      (entry) =>
        entry.active && entry.symptom_category === protocol.symptom_category,
    )
    .map((entry): RankedProduct | undefined => {
      const product = productById.get(entry.product_id);
      const verified = optionByIngredient.get(entry.ingredient_id);
      const link = productIngredients
        .get(entry.product_id)
        ?.find((item) => item.ingredient_id === entry.ingredient_id);
      // Public supply-performance reporting is not a permit, formulary, or
      // retail-availability status and must not decide clinical eligibility.
      if (
        !product ||
        !verified ||
        !link ||
        product.status !== "active" ||
        product.otc_status !== "otc" ||
        !activeSourceRefs(
          product.source_refs,
          request.knowledge.sourceSnapshotIds,
        ) ||
        !activeSourceRefs(link.source_refs, request.knowledge.sourceSnapshotIds)
      )
        return undefined;
      const imported = isHealthKrImported(product);
      const importedConfirmed = confirmedImportedProduct(product, protocol);
      if (imported && !importedConfirmed) return undefined;
      if (!entry.pharmacist_approved && !researchPreview) return undefined;
      if (
        !imported &&
        !explicitlySupportedProductIds(verified).has(product.product_id)
      )
        return undefined;
      const safetyAssessment = productSafetyAssessment(
        product,
        verified,
        request,
      );
      if (safetyAssessment.status === "ineligible") return undefined;
      if (
        safetyAssessment.status === "requires_context" &&
        !(researchPreview && request.allowProgressiveCandidates)
      )
        return undefined;
      const inventory = inventoryByProduct.get(product.product_id);
      if (
        request.tenant.inventory !== undefined &&
        (!inventory ||
          inventory.status !== "in_stock" ||
          inventory.available_quantity <= 0 ||
          !inventory.active ||
          inventory.discontinued)
      )
        return undefined;
      return {
        product,
        ingredientId: verified.ingredient.ingredient_id,
        option: verified.option,
        clinicalGroupKey: productClinicalGroupKey(
          product,
          verified.ingredient.ingredient_id,
        ),
        pendingSafetySlots: safetyAssessment.pendingSlots,
        ageScopeRank: ageScopeRankFor(product),
        sourceRefs: uniqueSourceRefs([
          ...sourceRefsFor(verified),
          ...product.source_refs,
          ...link.source_refs,
        ]),
        ...(inventory ? { inventory } : {}),
        ...(salesByProduct.get(product.product_id)
          ? { sales: salesByProduct.get(product.product_id)! }
          : {}),
      };
    })
    .filter((item): item is RankedProduct => Boolean(item))
    .sort((left, right) => {
      const safetyContext =
        left.pendingSafetySlots.length - right.pendingSafetySlots.length;
      if (safetyContext) return safetyContext;
      const ageScope = left.ageScopeRank - right.ageScopeRank;
      if (ageScope) return ageScope;
      // Sales can never alter clinical or safety eligibility. It is only the
      // final tie-breaker after clinical fit, safety, and inventory.
      const therapeuticFit = compareProtocolOptions(left.option, right.option);
      if (therapeuticFit) return therapeuticFit;
      const stock =
        (right.inventory?.available_quantity ?? 0) -
        (left.inventory?.available_quantity ?? 0);
      if (stock) return stock;
      const price = productPrice(left.product) - productPrice(right.product);
      if (price) return price;
      const sales =
        (left.sales?.sales_rank ?? Number.MAX_SAFE_INTEGER) -
        (right.sales?.sales_rank ?? Number.MAX_SAFE_INTEGER);
      if (sales) return sales;
      return left.product.product_id.localeCompare(right.product.product_id);
    });

  const seenProductIds = new Set<string>();
  const uniqueProducts = ranked.filter((item) => {
    if (seenProductIds.has(item.product.product_id)) return false;
    seenProductIds.add(item.product.product_id);
    return true;
  });
  // Products whose age/pregnancy context is still unknown stay listed but are
  // ranked after fully-cleared products (pendingSafetySlots is the first sort
  // key above). Removing them entirely would hide every official alternative
  // until the safety slots are answered, so unknown context demotes instead of
  // excluding; explicit restriction violations are already ineligible.
  const groupCounts = new Map<string, number>();
  for (const item of uniqueProducts)
    groupCounts.set(
      item.clinicalGroupKey,
      (groupCounts.get(item.clinicalGroupKey) ?? 0) + 1,
    );
  const seenGroups = new Set<string>();
  return uniqueProducts
    .filter((item) => {
      if (seenGroups.has(item.clinicalGroupKey)) return false;
      seenGroups.add(item.clinicalGroupKey);
      return true;
    })
    .map((item) => ({
      ...item,
      sameGroupProductCount: groupCounts.get(item.clinicalGroupKey) ?? 1,
    }));
};

export function buildRecommendationDecision(
  request: RecommendationRequest,
): RecommendationDecision {
  if (request.safety.mode === "escalate") return referDecision(request);
  if (request.safety.mode === "clarify") {
    const question = request.safety.askNext;
    if (!question) return noDecision(request, ["SAFETY_GATE_INCOMPLETE"]);
    if (request.consultationState?.asked_slots.includes(question.slot))
      return noDecision(request, ["QUESTION_ALREADY_ASKED"]);
    return askDecision(
      request,
      {
        question: question.question,
        reason: question.reason,
        slot: question.slot,
      },
      "SAFETY_GATE_ASK",
    );
  }
  if (request.safety.mode !== "continue")
    return noDecision(request, ["NO_SAFE_PROTOCOL_MATCH"]);

  const protocol = request.protocol;
  if (!protocol || !verifiedProtocol(protocol, request))
    return noDecision(request, ["PROTOCOL_NOT_VERIFIED"], protocol);

  const rules = rulesFor(protocol, request);
  const choiceFields = new Set(
    rules
      .filter(
        (rule) => rule.effect === "ask" && (rule.option_ids?.length ?? 0) > 0,
      )
      .map((rule) => rule.field),
  );
  const selectionRules = rules.filter(
    (rule) => rule.effect === "select" && choiceFields.has(rule.field),
  );
  for (const rule of rules) {
    const matched = ruleMatches(rule, request);
    if (rule.effect === "refer" && matched)
      return {
        ...noDecision(request, [rule.rule_id], protocol),
        status: "refer",
        referral: {
          urgency: "pharmacist_review",
          reason: rule.reason,
          action: "제품 후보를 제시하지 말고 약사가 직접 평가하세요.",
        },
      };
    if (
      rule.effect === "ask" &&
      !matched &&
      (!request.allowProgressiveCandidates ||
        (rule.option_ids?.length ?? 0) > 1)
    ) {
      const slot = slotName(rule.field);
      if (request.consultationState?.asked_slots.includes(slot))
        return noDecision(request, ["QUESTION_ALREADY_ASKED", rule.rule_id]);
      if (!rule.question)
        return noDecision(request, [
          "PROTOCOL_RULE_QUESTION_MISSING",
          rule.rule_id,
        ]);
      return askDecision(
        request,
        {
          question: renderedQuestion(rule.question, request),
          reason: rule.reason,
          slot,
        },
        rule.rule_id,
        protocol,
      );
    }
  }

  const exclusionOptionIds = new Set(
    rules
      .filter((rule) => rule.effect === "exclude" && ruleMatches(rule, request))
      .flatMap((rule) => rule.option_ids ?? []),
  );
  const selectedOptionIds = new Set(
    selectionRules
      .filter((rule) => ruleMatches(rule, request))
      .flatMap((rule) => rule.option_ids ?? []),
  );
  const unresolvedChoiceRule = rules.find(
    (rule) =>
      rule.effect === "ask" &&
      (rule.option_ids?.length ?? 0) > 0 &&
      !ruleMatches(rule, request),
  );
  const provisionalOptionId =
    request.allowProgressiveCandidates && selectedOptionIds.size === 0
      ? unresolvedChoiceRule?.option_ids?.[0]
      : undefined;
  const options = verifiedOptions(protocol, request)
    .filter((item) => !exclusionOptionIds.has(item.option.option_id))
    .filter(
      (item) =>
        item.option.therapeutic_role !== "conditional" ||
        selectedOptionIds.has(item.option.option_id),
    )
    .filter(
      (item) =>
        selectionRules.length === 0 ||
        (selectedOptionIds.size > 0
          ? selectedOptionIds.has(item.option.option_id)
          : provisionalOptionId === undefined ||
            item.option.option_id === provisionalOptionId),
    )
    .sort((left, right) => compareProtocolOptions(left.option, right.option));
  if (options.length === 0)
    return noDecision(request, ["NO_VERIFIED_INGREDIENT_OPTION"], protocol);

  // Every verified option participates in product ranking; truncating options
  // before ranking would silently drop most officially linked products. Only
  // the displayed lists below are capped by the decision contract.
  const rankedPool = rankedProducts(options, protocol, request);
  const products = rankedPool.slice(0, 5);
  if (request.tenant.inventory !== undefined && products.length === 0)
    return noDecision(request, ["NO_IN_STOCK_FORMULARY_PRODUCT"], protocol);

  const displayedIngredientIds = new Set(
    products.map((ranked) => ranked.ingredientId),
  );
  const ingredientOptions = [
    ...options.filter((verified) =>
      displayedIngredientIds.has(verified.ingredient.ingredient_id),
    ),
    ...options.filter(
      (verified) =>
        !displayedIngredientIds.has(verified.ingredient.ingredient_id),
    ),
  ]
    .slice(0, 3)
    .map((verified) => ({
      option_id: verified.option.option_id,
      ingredient_id: verified.ingredient.ingredient_id,
      ingredient_name: verified.ingredient.display_name_ko,
      claim_ids: [...verified.option.claim_ids] as [string, ...string[]],
      source_refs: [...sourceRefsFor(verified)] as [SourceRef, ...SourceRef[]],
      clinical_score: verified.option.clinical_priority / 100,
      safety_score: verified.option.safety_priority / 100,
    }));
  const productCandidates = products.map((ranked) => ({
    product_id: ranked.product.product_id,
    display_name:
      ranked.product.retail_offer?.display_name ?? ranked.product.display_name,
    ingredient_id: ranked.ingredientId,
    claim_ids: [...ranked.option.claim_ids] as [string, ...string[]],
    source_refs: [...ranked.sourceRefs] as [SourceRef, ...SourceRef[]],
    formulary_active: true,
    inventory_status: request.tenant.inventory
      ? ("in_stock" as const)
      : ("not_connected" as const),
    available_quantity: ranked.inventory?.available_quantity ?? null,
    sales_rank: ranked.sales?.sales_rank ?? null,
    manufacturer: ranked.product.manufacturer ?? null,
    specification: ranked.product.retail_offer?.specification ?? "",
    displayed_price_krw:
      ranked.product.retail_offer?.displayed_price_krw ?? null,
    price_recorded_at: ranked.product.retail_offer?.recorded_at ?? null,
    image_url: ranked.product.retail_offer?.image_url ?? null,
    image_source_url: ranked.product.retail_offer?.image_source_url ?? null,
    image_rights_status:
      ranked.product.retail_offer?.image_rights_status ?? null,
    image_kind: ranked.product.retail_offer?.image_kind ?? null,
    image_checked_at: ranked.product.retail_offer?.image_checked_at ?? null,
    ...(ranked.product.official_match_status
      ? { official_match_status: ranked.product.official_match_status }
      : {}),
    official_source_url: ranked.product.official_source_url ?? null,
    indication_summary: ranked.product.indication_summary ?? "",
    dosage_summary: ranked.product.dosage_summary ?? "",
    precaution_summary: ranked.product.precaution_summary ?? "",
    dosage_form: ranked.product.dosage_form ?? null,
    route: ranked.product.route ?? null,
    clinical_group_key: ranked.clinicalGroupKey,
    same_group_product_count: ranked.sameGroupProductCount ?? 1,
  }));
  const profilesFor = (ranked: RankedProduct) => {
    const productProfiles =
      ranked.product.pathway_profiles?.filter(
        (profile) => profile.protocol_id === protocol.protocol_id,
      ) ?? [];
    if (productProfiles.length > 0) return productProfiles;
    if (
      !ranked.option.pathway_mechanisms?.length ||
      !ranked.option.combination_roles?.length
    )
      return [];
    return [
      {
        protocol_id: protocol.protocol_id,
        mechanisms: ranked.option.pathway_mechanisms,
        combination_role: ranked.option.combination_roles[0],
        compatible_roles: ranked.option.compatible_roles ?? [],
        score: ranked.option.clinical_priority,
        source:
          ranked.option.source_refs[0]?.locator ?? "active protocol option",
      },
    ];
  };
  const activeIngredientIds = (ranked: RankedProduct) =>
    new Set(
      (ranked.product.active_ingredients ?? []).map(
        (ingredient) => ingredient.ingredient_id,
      ),
    );
  const mechanismLabels: Readonly<Record<string, string>> = {
    cough_suppression: "기침 억제",
    expectorant: "가래 배출",
    mucolytic: "가래 점도 감소",
    herbal_support: "생약 보조",
    local_support: "국소 보조",
    vitamin_support: "비타민·미네랄 보조",
    mucosal_barrier: "점막 보호",
    acid_suppression: "위산 억제",
    acid_neutralization: "위산 중화",
    digestive_enzyme: "소화효소 보충",
    motility_regulation: "위장 운동 조절",
    gas_reduction: "가스 감소",
    analgesia: "진통",
    antiinflammatory_analgesia: "소염·진통",
  };
  // Supportive partners are searched in a wider ranked pool than the five
  // displayed candidates so a complementary-mechanism product (e.g. herbal
  // support) still pairs with a displayed primary when the display list is
  // full of same-role alternatives.
  const supportivePool = rankedPool.slice(0, 32);
  const combinationCandidates = products
    .flatMap((primary) =>
      profilesFor(primary)
        .filter((profile) => profile.combination_role === "primary")
        .flatMap((primaryProfile) =>
          supportivePool.flatMap((supportive) => {
            if (supportive.product.product_id === primary.product.product_id)
              return [];
            const primaryIngredients = activeIngredientIds(primary);
            if (
              [...activeIngredientIds(supportive)].some((ingredientId) =>
                primaryIngredients.has(ingredientId),
              )
            )
              return [];
            const supportiveProfile = profilesFor(supportive).find(
              (profile) =>
                profile.combination_role === "supportive" &&
                profile.mechanisms.some(
                  (mechanism) =>
                    primaryProfile.compatible_roles.includes(mechanism) &&
                    !primaryProfile.mechanisms.includes(mechanism),
                ),
            );
            if (!supportiveProfile) return [];
            const complementaryMechanisms = supportiveProfile.mechanisms.filter(
              (mechanism) =>
                primaryProfile.compatible_roles.includes(mechanism) &&
                !primaryProfile.mechanisms.includes(mechanism),
            );
            const primaryMechanism =
              mechanismLabels[primaryProfile.mechanisms[0] ?? ""] ??
              "주 증상 완화";
            const supportiveMechanism =
              mechanismLabels[
                supportiveProfile.mechanisms.find((mechanism) =>
                  primaryProfile.compatible_roles.includes(mechanism),
                ) ?? ""
              ] ?? "다른 기전의 보조";
            return [
              {
                primary_product_id: primary.product.product_id,
                primary_product_name:
                  primary.product.retail_offer?.display_name ??
                  primary.product.display_name,
                supportive_product_id: supportive.product.product_id,
                supportive_product_name:
                  supportive.product.retail_offer?.display_name ??
                  supportive.product.display_name,
                primary_mechanisms: [...primaryProfile.mechanisms],
                supportive_mechanisms: complementaryMechanisms,
                rationale: `${primaryMechanism} 제품과 ${supportiveMechanism} 제품을 서로 다른 역할로 조합한 연구 미리보기입니다.`,
              },
            ];
          }),
        ),
    )
    .filter(
      (pair, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.primary_product_id === pair.primary_product_id &&
            candidate.supportive_product_id === pair.supportive_product_id,
        ) === index,
    )
    .slice(0, 2);
  const sourceRefs = uniqueSourceRefs([
    ...protocol.source_refs,
    ...ingredientOptions.flatMap((item) => item.source_refs),
    ...productCandidates.flatMap((item) => item.source_refs),
  ]);

  return {
    decision_id: decisionId(
      request.sessionId,
      request.sequence,
      protocol.protocol_id,
    ),
    status: "recommend",
    pack_id: request.knowledge.packId,
    protocol_id: protocol.protocol_id,
    intent: protocol.intent,
    tenant_inventory_connected: request.tenant.inventory !== undefined,
    ingredient_options:
      ingredientOptions as RecommendationDecision["ingredient_options"],
    product_candidates:
      productCandidates as RecommendationDecision["product_candidates"],
    combination_candidates: combinationCandidates as NonNullable<
      RecommendationDecision["combination_candidates"]
    >,
    question: null,
    referral: null,
    source_refs: sourceRefs,
    reason_codes: ["VERIFIED_PROTOCOL_OPTION"] as [string, ...string[]],
  };
}

export function renderDecisionSentence(
  decision: RecommendationDecision,
): string {
  switch (decision.status) {
    case "recommend": {
      const product = decision.product_candidates[0];
      const leadIngredient = product
        ? decision.ingredient_options.find(
            (item) => item.ingredient_id === product.ingredient_id,
          )
        : decision.ingredient_options[0];
      const ingredientLabel = leadIngredient
        ? leadIngredient.ingredient_name.endsWith("성분")
          ? leadIngredient.ingredient_name
          : `${leadIngredient.ingredient_name} 성분`
        : "허가 성분";
      return product
        ? `지금은 ${withKoreanObjectParticle(product.display_name)} 후보로 볼게요. 이 제품에는 ${ingredientLabel}이 들어 있어요.`
        : `지금은 ${withKoreanObjectParticle(ingredientLabel)} 중심으로 살펴볼게요.`;
    }
    case "ask":
      return (
        decision.question?.question ??
        "선택을 바꾸는 정보 하나가 더 필요합니다."
      );
    case "refer":
      return (
        decision.referral?.action ??
        "제품 후보를 제시하지 말고 의료진 또는 약사의 직접 평가를 받으세요."
      );
    case "insufficient":
      return "현재 활성 지식팩과 약국 데이터만으로는 검증된 후보를 결정할 수 없습니다.";
  }
}

const latinLettersWithFinalConsonant = new Set([
  "F",
  "L",
  "M",
  "N",
  "R",
  "S",
  "X",
]);
const digitsWithFinalConsonant = new Set(["0", "1", "3", "6", "7", "8"]);

export function withKoreanObjectParticle(value: string): string {
  const lastPronounced = [...value.trim()]
    .reverse()
    .find((character) => /[가-힣0-9A-Za-z]/u.test(character));
  if (!lastPronounced) return `${value}를`;
  const codePoint = lastPronounced.codePointAt(0) ?? 0;
  const hasFinalConsonant = /[가-힣]/u.test(lastPronounced)
    ? (codePoint - 0xac00) % 28 !== 0
    : /[0-9]/u.test(lastPronounced)
      ? digitsWithFinalConsonant.has(lastPronounced)
      : latinLettersWithFinalConsonant.has(lastPronounced.toUpperCase());
  return `${value}${hasFinalConsonant ? "을" : "를"}`;
}

export function assertDecisionInvariants(
  decision: RecommendationDecision,
): readonly string[] {
  const errors: string[] = [];
  if (decision.status === "recommend") {
    if (decision.ingredient_options.length === 0)
      errors.push("RECOMMEND_WITHOUT_INGREDIENT");
    if (decision.source_refs.length === 0)
      errors.push("RECOMMEND_WITHOUT_SOURCE");
    if (
      decision.tenant_inventory_connected &&
      decision.product_candidates.length === 0
    )
      errors.push("CONNECTED_INVENTORY_WITHOUT_PRODUCT");
  }
  if (decision.status === "ask" && !decision.question)
    errors.push("ASK_WITHOUT_QUESTION");
  if (decision.status === "refer" && decision.product_candidates.length > 0)
    errors.push("REFER_WITH_PRODUCT");
  if (decision.status !== "recommend" && decision.ingredient_options.length > 0)
    errors.push("NON_RECOMMEND_WITH_INGREDIENT");
  return errors;
}

export function nextConsultationState(
  prior: ConsultationState | undefined,
  input: Readonly<{
    sessionId: string;
    tenantId: string;
    sequence: number;
    packId: string;
    protocolId: string | null;
    intent: string | null;
    symptomCategory?: string | null;
    decision: RecommendationDecision;
    pendingQuestion?: Readonly<{
      question: string;
      reason: string;
      slot: string;
    }> | null;
    topicStates?: readonly ConsultationState["topics"][number][];
    answeredSlots?: Readonly<Record<string, unknown>>;
    now: Date;
  }>,
): ConsultationState {
  const asked = new Set(prior?.asked_slots ?? []);
  const pendingQuestion =
    input.pendingQuestion ??
    (input.decision.status === "ask" ? input.decision.question : null);
  if (pendingQuestion) asked.add(pendingQuestion.slot);
  const priorTopics = prior?.topics ?? [];
  const currentTopic = input.protocolId
    ? {
        protocol_id: input.protocolId,
        intent: input.intent ?? "",
        symptom_category: input.symptomCategory ?? "",
        answered_slots: {
          ...(priorTopics.find((item) => item.protocol_id === input.protocolId)
            ?.answered_slots ?? {}),
          ...(input.answeredSlots ?? {}),
        },
        asked_slots: [...asked],
        pending_question_slot: pendingQuestion?.slot ?? null,
        pending_question: pendingQuestion
          ? {
              question: pendingQuestion.question,
              reason: pendingQuestion.reason,
              slot: pendingQuestion.slot,
            }
          : null,
        last_decision_status: input.decision.status,
        updated_at: input.now.toISOString(),
      }
    : null;
  const topics = input.topicStates
    ? [...input.topicStates]
    : currentTopic
      ? [
          ...priorTopics.filter(
            (item) => item.protocol_id !== currentTopic.protocol_id,
          ),
          currentTopic,
        ]
      : [...priorTopics];
  return {
    session_id: input.sessionId,
    tenant_id: input.tenantId,
    sequence: input.sequence,
    pack_id: input.packId,
    answered_slots: {
      ...(prior?.answered_slots ?? {}),
      ...(input.answeredSlots ?? {}),
    },
    asked_slots: [...asked],
    topics: topics.slice(0, 8) as ConsultationState["topics"],
    pending_question_slot: pendingQuestion?.slot ?? null,
    active_protocol_id: input.protocolId,
    active_intent: input.intent,
    last_decision_status: input.decision.status,
    updated_at: input.now.toISOString(),
  };
}
