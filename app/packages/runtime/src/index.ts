import type {
  ConsultationState,
  RecommendationDecision,
  RuntimeInput,
  RuntimeOutput,
  RuntimePackContract,
  TenantFormulary,
  TenantInventory,
  TenantSalesAggregate,
} from "@pharmassist/contracts";
import {
  type Clock,
  type NormalizedInput,
  type SafetyDecision,
  type SlotEvidence,
  PharmassistError,
  systemClock,
} from "@pharmassist/domain";
import {
  type DecisionPackEntities,
  lintDecisionPack,
  lintForPublication,
} from "@pharmassist/knowledge";
import { normalizeKorean } from "@pharmassist/normalizer";
import {
  assertDecisionInvariants,
  buildRecommendationDecision,
  nextConsultationState,
  renderDecisionSentence,
  type TenantRecommendationContext,
} from "@pharmassist/recommendation";
import {
  buildDecisionIndex,
  buildIndex,
  retrieve,
  retrieveProtocols,
  type DecisionRetrievalIndex,
  type KnowledgeCard,
  type RetrievalIndex,
} from "@pharmassist/retrieval";
import { evaluateSafety } from "@pharmassist/safety";

export type RuntimePack = DecisionPackEntities &
  Readonly<{
    domain: "human_otc";
    cards: readonly KnowledgeCard[];
    publicationRecords?: readonly NonNullable<
      RuntimePackContract["publicationRecords"]
    >[number][];
  }>;

export interface RuntimeExecutionContext {
  readonly tenantId?: string;
  readonly formulary?: TenantFormulary;
  /** `undefined` means that this tenant has no inventory integration. */
  readonly inventory?: readonly TenantInventory[];
  readonly sales?: readonly TenantSalesAggregate[];
  readonly consultationState?: ConsultationState;
}

export interface EngineResult {
  readonly output: RuntimeOutput;
  readonly ruleIds: readonly string[];
  readonly externalRefinementAllowed: boolean;
  readonly bypassedDebounce: boolean;
  readonly consultationState: ConsultationState;
}

export type AppProfile = "local-demo" | "local-live" | "staging" | "production";

const uncertainAnswer = /모르|몰라|애매|기억(?:이)?\s*안|확실하지|글쎄/u;

const plausibleSlotAnswer = (
  slot: string,
  text: string,
  extracted: SlotEvidence | undefined,
): boolean => {
  if (extracted) return true;
  switch (slot) {
    case "duration":
      return /오늘|어제|그제|부터|\d+\s*(?:분|시간|일|주|개월|달|년)/u.test(
        text,
      );
    case "body_site":
      return /머리|목|가슴|명치|윗배|아랫배|배|허리|어깨|팔|다리|피부/u.test(
        text,
      );
    case "stool_pattern":
      return /묽|물변|설사|변비|딱딱|횟수|\d+\s*번/u.test(text);
    case "dyspepsia_pattern":
      return /더부룩|체한|소화|명치|속쓰림|쓰리|불편/u.test(text);
    case "skin_alarm":
      return /진물|통증|눈|입|얼굴|물집|없|아니/u.test(text);
    case "injury_inflammation":
    case "pain_pattern":
      return /다치|부딪|붓|뜨겁|열감|움직|가만|예|네|아니|없/u.test(text);
    default:
      return false;
  }
};

const evidence = (
  value: unknown,
  provenance: SlotEvidence["provenance"],
  verified = true,
): SlotEvidence => ({
  value,
  provenance,
  confidence: verified ? 1 : 0.4,
  verified,
});

const patientContextSlots = (
  context: RuntimeInput["patient_context"],
): Readonly<Record<string, SlotEvidence>> => {
  const result: Record<string, SlotEvidence> = {};
  const assign = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null && value !== "")
      result[key] = evidence(value, "context");
  };
  assign("age_years", context.age_years);
  assign("weight_kg", context.weight_kg);
  assign("sex_at_birth", context.sex_at_birth);
  assign("pregnancy_status", context.pregnancy_status);
  assign("gestational_weeks", context.gestational_weeks);
  assign("lactation_status", context.lactating);
  assign("duration", context.symptom_duration_text);
  assign(
    "allergies",
    context.allergies?.length ? context.allergies : undefined,
  );
  assign(
    "current_products",
    context.current_medications?.length
      ? context.current_medications
      : undefined,
  );
  assign(
    "conditions",
    context.conditions?.length ? context.conditions : undefined,
  );
  assign("product_name", context.product_name);
  assign("product_concentration", context.product_concentration);
  return result;
};

const protocolSeed = (
  protocolId: string | null | undefined,
  intent: string | null | undefined,
  index: DecisionRetrievalIndex,
): string | undefined => {
  const protocol =
    (protocolId ? index.protocols.get(protocolId) : undefined) ??
    (intent
      ? [...index.protocols.values()].find((item) => item.intent === intent)
      : undefined);
  return protocol?.triggers.anchors[0] ?? protocol?.triggers.aliases[0];
};

const withSlotsAndState = (
  normalized: NormalizedInput,
  input: RuntimeInput,
  prior: ConsultationState | undefined,
  pendingAnswerSlot: string | undefined,
  activeIntentSeed: string | undefined,
): NormalizedInput => {
  const slots: Record<string, SlotEvidence> = {};
  for (const [key, value] of Object.entries(prior?.answered_slots ?? {}))
    slots[key] = evidence(value, "context");
  Object.assign(slots, patientContextSlots(input.patient_context));
  Object.assign(slots, normalized.slots);

  if (
    pendingAnswerSlot &&
    !uncertainAnswer.test(normalized.normalizedText) &&
    plausibleSlotAnswer(
      pendingAnswerSlot,
      normalized.normalizedText,
      normalized.slots[pendingAnswerSlot],
    )
  ) {
    const extracted = normalized.slots[pendingAnswerSlot];
    slots[pendingAnswerSlot] = extracted
      ? {
          ...extracted,
          verified: true,
          confidence: Math.max(0.95, extracted.confidence),
        }
      : evidence(
          normalized.normalizedText,
          input.input_type.startsWith("voice") ? "voice" : "typed",
        );
  }

  const text = activeIntentSeed
    ? `${activeIntentSeed} ${normalized.normalizedText}`.trim()
    : normalized.normalizedText;
  return {
    ...normalized,
    normalizedText: text,
    tokens: [
      ...new Set([
        ...normalized.tokens,
        ...(activeIntentSeed ? [activeIntentSeed] : []),
      ]),
    ],
    slots,
  };
};

const answeredSlotValues = (
  normalized: NormalizedInput,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(normalized.slots)
      .filter(([, item]) => item.verified)
      .map(([key, item]) => [key, item.value]),
  );

const noDecision = (
  packId: string,
  input: RuntimeInput,
  inventoryConnected: boolean,
  reasonCodes: readonly string[],
  intent: string | null = null,
): RecommendationDecision => ({
  decision_id: `DEC-${input.session_id.replaceAll("-", "").toUpperCase()}-${input.sequence}`,
  status: "insufficient",
  pack_id: packId,
  protocol_id: null,
  intent,
  tenant_inventory_connected: inventoryConnected,
  ingredient_options: [],
  product_candidates: [],
  question: null,
  referral: null,
  source_refs: [],
  reason_codes: [...new Set(reasonCodes)] as [string, ...string[]],
});

const askDecision = (
  packId: string,
  input: RuntimeInput,
  inventoryConnected: boolean,
  question: Readonly<{ question: string; reason: string; slot: string }>,
  reasonCode: string,
  intent: string | null,
): RecommendationDecision => ({
  ...noDecision(packId, input, inventoryConnected, [reasonCode], intent),
  status: "ask",
  question: {
    question: question.question,
    reason: question.reason,
    slot: question.slot,
  },
});

const partialSafety = (): SafetyDecision => ({
  mode: "clarify",
  ruleIds: ["PARTIAL_PROVISIONAL"],
  redFlags: [],
  missingSlots: ["symptom_concepts"],
  sayNow: ["입력이 끝날 때까지 임상 결정을 확정하지 않습니다."],
  askNext: {
    question: "증상을 끝까지 말씀해 주세요.",
    reason: "완료된 입력 확인",
    priority: 1,
    slot: "symptom_concepts",
  },
  lockCritical: false,
});

const resolveRepeatedSafetyQuestion = (
  safety: SafetyDecision,
  normalized: NormalizedInput,
  prior: ConsultationState | undefined,
): SafetyDecision => {
  if (safety.mode !== "clarify" || !safety.askNext) return safety;
  const slot = safety.askNext.slot;
  const alreadyAsked = prior?.asked_slots.includes(slot) ?? false;
  const nowAnswered = normalized.slots[slot]?.verified ?? false;
  if (!alreadyAsked) return safety;
  if (
    nowAnswered &&
    safety.missingSlots.every((item) => normalized.slots[item]?.verified)
  )
    return {
      mode: "continue",
      ruleIds: [...safety.ruleIds, "ANSWERED_SAFETY_GATE"],
      redFlags: safety.redFlags,
      missingSlots: [],
      sayNow: [],
      lockCritical: safety.lockCritical,
    };
  return {
    mode: "no_match",
    ruleIds: [...safety.ruleIds, "QUESTION_ALREADY_ASKED"],
    redFlags: safety.redFlags,
    missingSlots: [],
    sayNow: [
      "같은 질문을 반복하지 않고, 현재 정보로 검증된 일반의약품 후보를 결정하지 않습니다.",
    ],
    lockCritical: safety.lockCritical,
  };
};

const outputShape = (
  decision: RecommendationDecision,
  safety: SafetyDecision,
): Pick<
  RuntimeOutput,
  "mode" | "status" | "say_now" | "ask_next" | "actions" | "missing_slots"
> => {
  switch (decision.status) {
    case "recommend":
      return {
        mode: "instant",
        status: "stable",
        say_now: [renderDecisionSentence(decision)],
        ask_next: [],
        actions: [
          {
            type: "present_verified_candidate",
            text: "활성 지식팩과 약국 formulary에서 검증된 후보만 표시한다.",
            requires_confirmation: true,
          },
        ],
        missing_slots: [],
      };
    case "ask":
      return {
        mode: "clarify",
        status: "blocked",
        say_now: ["추천 선택을 실제로 바꾸는 정보 한 가지만 확인해야 합니다."],
        ask_next: decision.question
          ? [
              {
                question: decision.question.question,
                reason: decision.question.reason,
                priority: 1,
                slot: decision.question.slot,
              },
            ]
          : [],
        actions: [],
        missing_slots: decision.question ? [decision.question.slot] : [],
      };
    case "refer":
      return {
        mode: "escalate",
        status: "final",
        say_now: [renderDecisionSentence(decision)],
        ask_next: [],
        actions: [
          {
            type: "refer",
            text: decision.referral?.action ?? "직접 평가를 받는다.",
            requires_confirmation: true,
          },
        ],
        missing_slots: [],
      };
    case "insufficient":
      return {
        mode: safety.mode === "clarify" ? "clarify" : "no_match",
        status: "final",
        say_now: safety.sayNow.length
          ? [safety.sayNow[0]!]
          : [renderDecisionSentence(decision)],
        ask_next: [],
        actions: [
          {
            type: "pharmacist_review_or_restart",
            text: "활성 지식팩을 벗어난 추정 없이 약사 검토 또는 새 상담으로 전환한다.",
            requires_confirmation: false,
          },
        ],
        missing_slots: [],
      };
  }
};

export class LocalClinicalEngine {
  readonly index: RetrievalIndex;
  readonly decisionIndex: DecisionRetrievalIndex;

  constructor(
    readonly pack: RuntimePack,
    readonly profile: AppProfile = "local-demo",
    readonly clock: Clock = systemClock,
  ) {
    const lintProfile =
      profile === "production"
        ? "production"
        : profile === "staging"
          ? "staging"
          : "local-demo";
    const decisionErrors = lintDecisionPack(pack, lintProfile, clock.now());
    const publicationErrors = pack.publicationRecords
      ? lintForPublication(
          pack.publicationRecords,
          profile === "production" ? "production" : "local-demo",
          clock.now(),
        )
      : [];
    if (decisionErrors.length > 0 || publicationErrors.length > 0)
      throw new PharmassistError(
        "KNOWLEDGE_STALE",
        `Knowledge pack activation blocked: ${[
          ...decisionErrors,
          ...publicationErrors,
        ].join(",")}`,
        false,
        "previous_pack",
      );
    this.index = buildIndex(pack.cards, clock.now());
    this.decisionIndex = buildDecisionIndex(pack, clock.now());
  }

  run(
    input: RuntimeInput,
    context: RuntimeExecutionContext = {},
  ): EngineResult {
    const started = this.clock.monotonicMs();
    const now = this.clock.now();
    const tenantId = context.tenantId ?? "local-demo";
    const prior =
      context.consultationState?.session_id === input.session_id &&
      context.consultationState.tenant_id === tenantId &&
      context.consultationState.pack_id === this.pack.packId &&
      context.consultationState.sequence < input.sequence
        ? context.consultationState
        : undefined;

    const normalizeStart = this.clock.monotonicMs();
    const rawNormalized = normalizeKorean(
      input.text,
      input.asr?.alternatives ?? [],
    );
    const uncertainReply = Boolean(
      prior?.pending_question_slot &&
      uncertainAnswer.test(rawNormalized.normalizedText),
    );
    const preliminaryProtocols = uncertainReply
      ? []
      : retrieveProtocols(rawNormalized, input.domain, this.decisionIndex);
    const startsNewIntent = Boolean(
      preliminaryProtocols[0] &&
      prior?.active_intent &&
      preliminaryProtocols[0].intent !== prior.active_intent,
    );
    const pendingAnswerSlot =
      prior?.pending_question_slot && !startsNewIntent
        ? prior.pending_question_slot
        : undefined;
    const activeSeed =
      preliminaryProtocols.length === 0 && !startsNewIntent
        ? protocolSeed(
            prior?.active_protocol_id,
            prior?.active_intent,
            this.decisionIndex,
          )
        : undefined;
    const normalized = withSlotsAndState(
      rawNormalized,
      input,
      prior,
      pendingAnswerSlot,
      activeSeed,
    );
    const normalizeMs = this.clock.monotonicMs() - normalizeStart;

    const safetyStart = this.clock.monotonicMs();
    const evaluatedSafety = evaluateSafety(normalized, input.domain);
    const initialSafety =
      input.is_partial || input.input_type === "voice_partial"
        ? evaluatedSafety.mode === "continue"
          ? partialSafety()
          : evaluatedSafety
        : evaluatedSafety;
    const safety = resolveRepeatedSafetyQuestion(
      initialSafety,
      normalized,
      prior,
    );
    const safetyMs = this.clock.monotonicMs() - safetyStart;

    const retrievalStart = this.clock.monotonicMs();
    const protocolCandidates = uncertainReply
      ? []
      : retrieveProtocols(normalized, input.domain, this.decisionIndex);
    const protocolCandidate = protocolCandidates[0];
    const protocol = protocolCandidate
      ? this.decisionIndex.protocols.get(protocolCandidate.protocolId)
      : !startsNewIntent
        ? ((prior?.active_protocol_id
            ? this.decisionIndex.protocols.get(prior.active_protocol_id)
            : undefined) ??
          (prior?.active_intent
            ? [...this.decisionIndex.protocols.values()].find(
                (item) => item.intent === prior.active_intent,
              )
            : undefined))
        : undefined;
    const cardCandidates = uncertainReply
      ? []
      : retrieve(normalized, input.domain, this.index);
    const cardCandidate = cardCandidates[0];
    const card = cardCandidate
      ? this.index.cards.get(cardCandidate.cardId)
      : prior?.active_intent && !startsNewIntent
        ? [...this.index.cards.values()].find(
            (item) => item.intent === prior.active_intent,
          )
        : undefined;
    const retrieveMs = this.clock.monotonicMs() - retrievalStart;

    const tenant: TenantRecommendationContext = {
      tenantId,
      ...(context.formulary ? { formulary: context.formulary } : {}),
      ...(context.inventory !== undefined
        ? { inventory: context.inventory }
        : {}),
      ...(context.sales ? { sales: context.sales } : {}),
    };
    let decision = buildRecommendationDecision({
      sequence: input.sequence,
      sessionId: input.session_id,
      now,
      normalized,
      safety,
      ...(protocol ? { protocol } : {}),
      knowledge: {
        packId: this.pack.packId,
        sourceSnapshotIds: new Set(
          this.pack.sources.map((item) => item.source_snapshot_id),
        ),
        ingredients: this.pack.ingredients,
        products: this.pack.products,
        productIngredients: this.pack.productIngredients,
        claims: this.pack.claims,
        protocolOptions: this.pack.protocolOptions,
        protocolRules: this.pack.protocolRules,
      },
      tenant,
      ...(prior ? { consultationState: prior } : {}),
    });

    if (
      decision.status === "insufficient" &&
      safety.mode === "continue" &&
      !protocol &&
      card &&
      !(prior?.asked_slots.includes(card.askNext.slot) ?? false)
    )
      decision = askDecision(
        this.pack.packId,
        input,
        context.inventory !== undefined,
        card.askNext,
        "LEGACY_CARD_COMPATIBILITY_ASK",
        card.intent,
      );

    const invariantErrors = assertDecisionInvariants(decision);
    if (invariantErrors.length > 0)
      decision = noDecision(
        this.pack.packId,
        input,
        context.inventory !== undefined,
        ["DECISION_INVARIANT_FAILURE", ...invariantErrors],
        protocol?.intent ?? card?.intent ?? null,
      );

    const shape = outputShape(decision, safety);
    const partial = input.is_partial || input.input_type === "voice_partial";
    const topScore = protocolCandidate?.score ?? cardCandidate?.score ?? 0;
    const output: RuntimeOutput = {
      request_id: input.request_id,
      session_id: input.session_id,
      sequence: input.sequence,
      ...shape,
      status:
        partial && decision.status !== "refer" ? "provisional" : shape.status,
      intent:
        decision.intent ??
        protocol?.intent ??
        card?.intent ??
        prior?.active_intent ??
        null,
      red_flags: [...safety.redFlags],
      avoid: card?.avoid
        ? [...card.avoid]
        : [
            "활성 pack에 없는 성분·제품·claim을 생성하지 않습니다.",
            "판매량과 마진은 임상 적합성이나 안전성 점수를 바꾸지 않습니다.",
          ],
      confidence:
        decision.status === "refer"
          ? 1
          : decision.status === "recommend"
            ? Math.max(0.8, topScore)
            : Math.min(0.79, topScore),
      candidate_intents: protocolCandidates.slice(0, 3).map((candidate) => ({
        intent: candidate.intent,
        score: candidate.score,
      })) as NonNullable<RuntimeOutput["candidate_intents"]>,
      decision,
      source_refs: [...decision.source_refs],
      latency: {
        total_ms: this.clock.monotonicMs() - started,
        normalize_ms: normalizeMs,
        safety_ms: safetyMs,
        retrieve_ms: retrieveMs,
        refine_ms: 0,
      },
      knowledge_version: this.pack.version,
      model: null,
      generated_at: now.toISOString(),
      stale_response_dropped: false,
    };
    const consultationState = nextConsultationState(prior, {
      sessionId: input.session_id,
      tenantId,
      sequence: input.sequence,
      packId: this.pack.packId,
      protocolId: decision.protocol_id ?? protocol?.protocol_id ?? null,
      intent: output.intent,
      decision,
      answeredSlots: answeredSlotValues(normalized),
      now,
    });

    return {
      output,
      ruleIds: [...new Set([...safety.ruleIds, ...decision.reason_codes])],
      externalRefinementAllowed:
        rawNormalized.safeForExternal &&
        !partial &&
        decision.status !== "refer",
      bypassedDebounce: decision.status === "refer",
      consultationState,
    };
  }
}
