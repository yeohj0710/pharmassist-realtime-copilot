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
import type { NormalizedInput, SafetyDecision } from "@pharmassist/domain";

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

const decisionId = (sessionId: string, sequence: number): string =>
  `DEC-${sessionId.replaceAll("-", "").toUpperCase()}-${sequence}`;

const noDecision = (
  request: RecommendationRequest,
  reasonCodes: readonly string[],
  protocol: OTCProtocol | undefined = request.protocol,
): RecommendationDecision => ({
  decision_id: decisionId(request.sessionId, request.sequence),
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

const fieldValue = (
  rule: ProtocolRule,
  request: RecommendationRequest,
): unknown => {
  if (rule.field === "normalized_text")
    return request.normalized.normalizedText;
  const name = slotName(rule.field);
  const persisted = request.consultationState?.answered_slots[name];
  if (persisted !== undefined) return persisted;
  return request.normalized.slots[name]?.value;
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
      const pattern = typeof rule.value === "string" ? rule.value : "(?!)";
      let matched = false;
      try {
        matched = new RegExp(pattern, "iu").test(String(actual ?? ""));
      } catch {
        matched = false;
      }
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
  activeReview(protocol.review, request.now) &&
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
        !activeReview(claim.review, request.now) ||
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
        activeReview(option.review, request.now) &&
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
        !activeReview(ingredient.review, request.now) ||
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
        activeReview(rule.review, request.now) &&
        activeSourceRefs(rule.source_refs, request.knowledge.sourceSnapshotIds),
    )
    .sort((left, right) => left.priority - right.priority);

const sourceRefsFor = (verified: VerifiedOption): readonly SourceRef[] =>
  uniqueSourceRefs([
    ...verified.option.source_refs,
    ...verified.ingredient.source_refs,
    ...verified.claims.flatMap((claim) => claim.source_refs),
  ]);

interface RankedProduct {
  readonly product: DrugProduct;
  readonly ingredientId: string;
  readonly option: ProtocolOption;
  readonly sourceRefs: readonly SourceRef[];
  readonly inventory?: TenantInventory;
  readonly sales?: TenantSalesAggregate;
}

const rankedProducts = (
  options: readonly VerifiedOption[],
  protocol: OTCProtocol,
  request: RecommendationRequest,
): readonly RankedProduct[] => {
  const activeFormulary =
    request.tenant.formulary?.tenant_id === request.tenant.tenantId &&
    request.tenant.formulary.pack_id === request.knowledge.packId &&
    request.tenant.formulary.status === "active" &&
    activeReview(request.tenant.formulary.review, request.now)
      ? request.tenant.formulary
      : undefined;
  if (!activeFormulary) return [];

  const optionByIngredient = new Map(
    options.map((item) => [item.ingredient.ingredient_id, item] as const),
  );
  const productById = new Map(
    request.knowledge.products.map(
      (product) => [product.product_id, product] as const,
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
          item.pack_id === request.knowledge.packId,
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

  return activeFormulary.entries
    .filter(
      (entry) =>
        entry.active &&
        entry.pharmacist_approved &&
        entry.symptom_category === protocol.symptom_category,
    )
    .map((entry): RankedProduct | undefined => {
      const product = productById.get(entry.product_id);
      const verified = optionByIngredient.get(entry.ingredient_id);
      const link = productIngredients
        .get(entry.product_id)
        ?.find((item) => item.ingredient_id === entry.ingredient_id);
      if (
        !product ||
        !verified ||
        !link ||
        product.status !== "active" ||
        product.otc_status !== "otc" ||
        product.supply_performance === false ||
        !activeSourceRefs(
          product.source_refs,
          request.knowledge.sourceSnapshotIds,
        ) ||
        !activeSourceRefs(link.source_refs, request.knowledge.sourceSnapshotIds)
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
      // Sales can never alter clinical or safety eligibility. It is only the
      // final tie-breaker after clinical fit, safety, and inventory.
      const clinical =
        right.option.clinical_priority - left.option.clinical_priority;
      if (clinical) return clinical;
      const safety = right.option.safety_priority - left.option.safety_priority;
      if (safety) return safety;
      const stock =
        (right.inventory?.available_quantity ?? 0) -
        (left.inventory?.available_quantity ?? 0);
      if (stock) return stock;
      const sales =
        (left.sales?.sales_rank ?? Number.MAX_SAFE_INTEGER) -
        (right.sales?.sales_rank ?? Number.MAX_SAFE_INTEGER);
      if (sales) return sales;
      return left.product.product_id.localeCompare(right.product.product_id);
    });
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
    if (rule.effect === "ask" && !matched) {
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
        { question: rule.question, reason: rule.reason, slot },
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
    rules
      .filter((rule) => rule.effect === "select" && ruleMatches(rule, request))
      .flatMap((rule) => rule.option_ids ?? []),
  );
  const options = verifiedOptions(protocol, request)
    .filter((item) => !exclusionOptionIds.has(item.option.option_id))
    .filter(
      (item) =>
        selectedOptionIds.size === 0 ||
        selectedOptionIds.has(item.option.option_id),
    )
    .sort(
      (left, right) =>
        right.option.clinical_priority - left.option.clinical_priority ||
        right.option.safety_priority - left.option.safety_priority ||
        left.option.option_id.localeCompare(right.option.option_id),
    )
    .slice(0, 3);
  if (options.length === 0)
    return noDecision(request, ["NO_VERIFIED_INGREDIENT_OPTION"], protocol);

  const products = rankedProducts(options, protocol, request).slice(0, 5);
  if (request.tenant.inventory !== undefined && products.length === 0)
    return noDecision(request, ["NO_IN_STOCK_FORMULARY_PRODUCT"], protocol);

  const ingredientOptions = options.map((verified) => ({
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
    display_name: ranked.product.display_name,
    ingredient_id: ranked.ingredientId,
    claim_ids: [...ranked.option.claim_ids] as [string, ...string[]],
    source_refs: [...ranked.sourceRefs] as [SourceRef, ...SourceRef[]],
    formulary_active: true,
    inventory_status: request.tenant.inventory
      ? ("in_stock" as const)
      : ("not_connected" as const),
    available_quantity: ranked.inventory?.available_quantity ?? null,
    sales_rank: ranked.sales?.sales_rank ?? null,
  }));
  const sourceRefs = uniqueSourceRefs([
    ...protocol.source_refs,
    ...ingredientOptions.flatMap((item) => item.source_refs),
    ...productCandidates.flatMap((item) => item.source_refs),
  ]);

  return {
    decision_id: decisionId(request.sessionId, request.sequence),
    status: "recommend",
    pack_id: request.knowledge.packId,
    protocol_id: protocol.protocol_id,
    intent: protocol.intent,
    tenant_inventory_connected: request.tenant.inventory !== undefined,
    ingredient_options:
      ingredientOptions as RecommendationDecision["ingredient_options"],
    product_candidates:
      productCandidates as RecommendationDecision["product_candidates"],
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
      const ingredients = decision.ingredient_options
        .map((item) => item.ingredient_name)
        .join(" 또는 ");
      const product = decision.product_candidates[0];
      return product
        ? `${ingredients} 성분에 해당하고 현재 재고가 확인된 제품 후보는 ${product.display_name}이며, 약사가 최종 확인해 선택하세요.`
        : `${ingredients} 성분 후보를 약사가 현재 복용약과 금기를 최종 확인해 선택하세요.`;
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
    decision: RecommendationDecision;
    answeredSlots?: Readonly<Record<string, unknown>>;
    now: Date;
  }>,
): ConsultationState {
  const asked = new Set(prior?.asked_slots ?? []);
  if (input.decision.status === "ask" && input.decision.question)
    asked.add(input.decision.question.slot);
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
    pending_question_slot:
      input.decision.status === "ask" && input.decision.question
        ? input.decision.question.slot
        : null,
    active_protocol_id: input.protocolId,
    active_intent: input.intent,
    last_decision_status: input.decision.status,
    updated_at: input.now.toISOString(),
  };
}
