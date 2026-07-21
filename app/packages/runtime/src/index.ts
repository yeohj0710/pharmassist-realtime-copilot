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
  nextCandidateSafetyQuestion,
  nextConsultationState,
  nextProtocolQuestion,
  renderDecisionSentence,
  type TenantRecommendationContext,
  withKoreanObjectParticle,
} from "@pharmassist/recommendation";
import {
  buildDecisionIndex,
  buildIndex,
  retrieve,
  retrieveProtocols,
  type DecisionRetrievalIndex,
  type KnowledgeCard,
  type ProtocolCandidate,
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

type ConsultationTopic = ConsultationState["topics"][number];
type TopicResult = RuntimeOutput["topic_results"][number];

const uncertainAnswer = /모르|몰라|애매|기억(?:이)?\s*안|확실하지|글쎄/u;
const uncertainClarificationQuestion = {
  question:
    "괜찮아요. 지금 가장 불편한 느낌을 평소 말씀하시는 표현으로 알려주세요.",
  reason: "답하기 쉬운 표현으로 상담 주제 확인",
  slot: "patient.detail",
} as const;

const conversationalReply = (text: string): string | undefined => {
  const compact = text
    .trim()
    .replace(/[.!?~]+$/gu, "")
    .trim();
  if (
    /^(?:어이|저기(?:요)?|여보세요|안녕(?:하세요)?|하이|헬로)$/u.test(compact)
  )
    return "네, 말씀하세요. 증상이나 찾는 약을 편하게 말씀해 주세요.";
  if (/^(?:고마워(?:요)?|감사(?:합니다|해요)?|땡큐)$/u.test(compact))
    return "천만에요. 더 궁금한 점이 있으면 이어서 말씀해 주세요.";
  if (
    /(?:뭐|무엇).*(?:할 수|해줄)|(?:어떻게|방법).*(?:써|사용)|사용법/u.test(
      compact,
    )
  )
    return "증상을 편하게 말씀해 주시면 확인할 제품과 성분을 정리해 드려요. 복용 중인 약이나 알레르기도 함께 말씀하실 수 있어요.";
  if (
    /^(?:너|당신)?\s*(?:누구|뭐 하는|뭐하는)(?:데|거야|거예요)?$/u.test(compact)
  )
    return "약국 상담을 돕는 도우미예요. 증상에 맞는 일반의약품 후보와 관련 성분을 정리해 드려요.";
  return undefined;
};

const protocolCandidateForIntent = (
  intent: string | undefined,
  cards: readonly KnowledgeCard[],
  index: DecisionRetrievalIndex,
): ProtocolCandidate | undefined => {
  if (!intent) return undefined;
  const card = cards.find((item) => item.intent === intent);
  if (!card) return undefined;
  const aliases = new Set(card.aliases.map((value) => value.normalize("NFKC")));
  return [...index.protocols.values()]
    .map((protocol) => {
      const matchedTerms = protocol.triggers.aliases.filter((alias) =>
        aliases.has(alias.normalize("NFKC")),
      );
      return {
        protocolId: protocol.protocol_id,
        intent: protocol.intent,
        score: Math.min(1, 0.7 + matchedTerms.length * 0.05),
        matchedTerms,
      };
    })
    .filter((candidate) => candidate.matchedTerms.length > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.protocolId.localeCompare(right.protocolId),
    )[0];
};

const plausibleSlotAnswer = (
  slot: string,
  text: string,
  extracted: SlotEvidence | undefined,
  acceptedPatterns: readonly string[],
): boolean => {
  if (extracted) return true;
  const normalizedText = text.normalize("NFKC").toLowerCase();
  if (
    acceptedPatterns.some((pattern) =>
      normalizedText.includes(pattern.normalize("NFKC").toLowerCase()),
    )
  )
    return true;
  const semanticSlot = slot.split(".").at(-1) ?? slot;
  switch (semanticSlot) {
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
    case "musculoskeletal_pattern":
      return /다치|부딪|붓|뜨겁|열감|움직|가만|예|네|아니|없/u.test(text);
    case "swallowing_severity":
      return /삼키|삼킬|침|물|따갑|아픈\s*정도|못\s*넘|힘들|어렵/u.test(text);
    default:
      return false;
  }
};

const pendingSlotPatterns = (
  pack: RuntimePack,
  protocolId: string | null | undefined,
  slot: string,
): readonly string[] => {
  const protocol = protocolId
    ? pack.protocols.find((item) => item.protocol_id === protocolId)
    : undefined;
  if (!protocol) return [];
  return pack.protocolRules
    .filter(
      (rule) =>
        protocol.rule_ids.includes(rule.rule_id) &&
        rule.protocol_id === protocol.protocol_id &&
        rule.effect === "ask" &&
        (rule.field.startsWith("slot.")
          ? rule.field.slice("slot.".length)
          : rule.field) === slot,
    )
    .flatMap((rule) =>
      (typeof rule.value === "string"
        ? [rule.value]
        : Array.isArray(rule.value)
          ? rule.value.filter(
              (value): value is string => typeof value === "string",
            )
          : []
      ).filter((value) => !/^__.*__$/u.test(value)),
    );
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
  pendingAnswer:
    | Readonly<{
        readonly slot: string;
        readonly accepted: boolean;
        readonly resolved: boolean;
      }>
    | undefined,
  activeIntentSeed: string | undefined,
): NormalizedInput => {
  const slots: Record<string, SlotEvidence> = {};
  for (const [key, value] of Object.entries(prior?.answered_slots ?? {}))
    slots[key] = evidence(value, "context");
  Object.assign(slots, patientContextSlots(input.patient_context));
  Object.assign(slots, normalized.slots);

  if (
    pendingAnswer?.accepted &&
    !uncertainAnswer.test(normalized.normalizedText)
  ) {
    const extracted = normalized.slots[pendingAnswer.slot];
    slots[pendingAnswer.slot] = extracted
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

const sharedPatientSlotNames = new Set([
  "age_years",
  "weight_kg",
  "sex_at_birth",
  "pregnancy_status",
  "gestational_weeks",
  "lactation_status",
  "allergies",
  "current_products",
  "conditions",
]);

const answeredSlotValues = (
  normalized: NormalizedInput,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(normalized.slots)
      .filter(
        ([key, item]) =>
          item.verified ||
          (sharedPatientSlotNames.has(key) && item.confidence >= 0.9),
      )
      .map(([key, item]) => [key, item.value]),
  );

const topicConsultationState = (
  prior: ConsultationState,
  topic: ConsultationTopic,
): ConsultationState => ({
  ...prior,
  answered_slots: topic.answered_slots,
  asked_slots: topic.asked_slots,
  pending_question_slot: topic.pending_question_slot,
  active_protocol_id: topic.protocol_id,
  active_intent: topic.intent,
  last_decision_status: topic.last_decision_status,
});

const sharedPatientConsultationState = (
  prior: ConsultationState,
): ConsultationState => ({
  ...prior,
  answered_slots: Object.fromEntries(
    Object.entries(prior.answered_slots).filter(([key]) =>
      sharedPatientSlotNames.has(key),
    ),
  ),
  asked_slots: [],
  pending_question_slot: null,
  active_protocol_id: null,
  active_intent: null,
  last_decision_status: null,
});

const outputQuestion = (
  question:
    | Readonly<{ question: string; reason: string; slot: string }>
    | null
    | undefined,
): TopicResult["ask_next"] =>
  question
    ? [
        {
          question: question.question,
          reason: question.reason,
          priority: 1,
          slot: question.slot,
        },
      ]
    : [];

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
        say_now: ["증상에 맞는 약을 고르려면 한 가지만 더 여쭤볼게요."],
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
    this.decisionIndex = buildDecisionIndex(
      pack,
      clock.now(),
      profile !== "production" &&
        pack.clinicalUseProhibited === true &&
        pack.synthetic === false,
    );
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
    const conversationReply = conversationalReply(rawNormalized.normalizedText);
    const uncertainReply = Boolean(
      prior?.pending_question_slot &&
      uncertainAnswer.test(rawNormalized.normalizedText),
    );
    const retrievedProtocols = uncertainReply
      ? []
      : retrieveProtocols(
          rawNormalized,
          input.domain,
          this.decisionIndex,
          3,
          !prior?.pending_question_slot,
        );
    const answersPriorPendingQuestion = Boolean(
      prior?.pending_question_slot &&
      plausibleSlotAnswer(
        prior.pending_question_slot,
        rawNormalized.normalizedText,
        rawNormalized.slots[prior.pending_question_slot],
        pendingSlotPatterns(
          this.pack,
          prior.active_protocol_id,
          prior.pending_question_slot,
        ),
      ),
    );
    const hintedProtocol = protocolCandidateForIntent(
      input.intent_hint,
      this.pack.cards,
      this.decisionIndex,
    );
    const preliminaryProtocols =
      retrievedProtocols.length > 0
        ? retrievedProtocols
        : hintedProtocol && !answersPriorPendingQuestion
          ? [hintedProtocol]
          : [];
    const preliminaryCards = uncertainReply
      ? []
      : retrieve(rawNormalized, input.domain, this.index);
    const strongPreliminaryCard = preliminaryCards.find(
      (candidate) => candidate.score >= 0.8,
    );
    const incomingIntent =
      preliminaryProtocols[0]?.intent ??
      (answersPriorPendingQuestion
        ? prior?.active_intent
        : input.intent_hint) ??
      strongPreliminaryCard?.intent;
    const incomingProtocolId = preliminaryProtocols[0]?.protocolId;
    const focusTopic = prior?.topics.find((item) =>
      incomingProtocolId
        ? item.protocol_id === incomingProtocolId
        : item.protocol_id === prior.active_protocol_id,
    );
    const focusPrior =
      prior && prior.topics.length > 0
        ? focusTopic
          ? topicConsultationState(prior, focusTopic)
          : sharedPatientConsultationState(prior)
        : prior;
    const startsNewIntent = Boolean(
      incomingIntent &&
      prior?.active_intent &&
      incomingIntent !== prior.active_intent,
    );
    const pendingAnswerSlot =
      focusPrior?.pending_question_slot && !startsNewIntent
        ? focusPrior.pending_question_slot
        : undefined;
    const pendingAnswer = pendingAnswerSlot
      ? (() => {
          const accepted = plausibleSlotAnswer(
            pendingAnswerSlot,
            rawNormalized.normalizedText,
            rawNormalized.slots[pendingAnswerSlot],
            pendingSlotPatterns(
              this.pack,
              focusPrior?.active_protocol_id,
              pendingAnswerSlot,
            ),
          );
          return {
            slot: pendingAnswerSlot,
            accepted,
            resolved:
              accepted ||
              preliminaryProtocols.some(
                (candidate) =>
                  candidate.protocolId === focusPrior?.active_protocol_id,
              ),
          };
        })()
      : undefined;
    const activeSeed =
      preliminaryProtocols.length === 0 && !startsNewIntent
        ? protocolSeed(
            focusPrior?.active_protocol_id,
            focusPrior?.active_intent,
            this.decisionIndex,
          )
        : undefined;
    const normalized = withSlotsAndState(
      rawNormalized,
      input,
      focusPrior,
      pendingAnswer,
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
      focusPrior,
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
        ? ((focusPrior?.active_protocol_id
            ? this.decisionIndex.protocols.get(focusPrior.active_protocol_id)
            : undefined) ??
          (focusPrior?.active_intent
            ? [...this.decisionIndex.protocols.values()].find(
                (item) => item.intent === focusPrior.active_intent,
              )
            : undefined))
        : undefined;
    const currentProtocolIds = new Set(
      protocolCandidates.map((candidate) => candidate.protocolId),
    );
    const orderedTopicProtocols = [
      ...(protocol ? [protocol] : []),
      ...protocolCandidates
        .map((candidate) =>
          this.decisionIndex.protocols.get(candidate.protocolId),
        )
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      ...(prior?.topics ?? [])
        .map((topic) => this.decisionIndex.protocols.get(topic.protocol_id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ].filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) => candidate.protocol_id === item.protocol_id,
        ) === index,
    );
    const cardCandidates = uncertainReply
      ? []
      : retrieve(normalized, input.domain, this.index);
    const cardCandidate = cardCandidates[0];
    const card = cardCandidate
      ? this.index.cards.get(cardCandidate.cardId)
      : focusPrior?.active_intent && !startsNewIntent
        ? [...this.index.cards.values()].find(
            (item) => item.intent === focusPrior.active_intent,
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
    const knowledge = {
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
    };
    const allowProgressiveCandidates =
      this.pack.clinicalUseProhibited && !this.pack.synthetic;
    const recommendationRequest = {
      sequence: input.sequence,
      sessionId: input.session_id,
      now,
      normalized,
      safety,
      ...(protocol ? { protocol } : {}),
      knowledge,
      tenant,
      allowProgressiveCandidates,
      ...(focusPrior ? { consultationState: focusPrior } : {}),
    };
    let decision = buildRecommendationDecision(recommendationRequest);
    const progressiveQuestion =
      decision.status === "recommend"
        ? (nextProtocolQuestion(recommendationRequest) ??
          nextCandidateSafetyQuestion(recommendationRequest, decision))
        : null;
    const additionalTopicEvaluations = orderedTopicProtocols
      .filter(
        (topicProtocol) => topicProtocol.protocol_id !== protocol?.protocol_id,
      )
      .map((topicProtocol) => {
        const priorTopic = prior?.topics.find(
          (item) => item.protocol_id === topicProtocol.protocol_id,
        );
        const priorTopicState =
          prior && priorTopic
            ? topicConsultationState(prior, priorTopic)
            : undefined;
        const mentionedNow = currentProtocolIds.has(topicProtocol.protocol_id);
        const topicRaw = mentionedNow
          ? rawNormalized
          : normalizeKorean(
              protocolSeed(
                topicProtocol.protocol_id,
                topicProtocol.intent,
                this.decisionIndex,
              ) ??
                topicProtocol.triggers.anchors[0] ??
                "",
            );
        const topicNormalized = withSlotsAndState(
          topicRaw,
          input,
          priorTopicState,
          undefined,
          undefined,
        );
        const topicRequest = {
          sequence: input.sequence,
          sessionId: input.session_id,
          now,
          normalized: topicNormalized,
          safety,
          protocol: topicProtocol,
          knowledge,
          tenant,
          allowProgressiveCandidates,
          ...(priorTopicState ? { consultationState: priorTopicState } : {}),
        };
        const topicDecision = buildRecommendationDecision(topicRequest);
        const nextQuestion =
          mentionedNow && topicDecision.status === "recommend"
            ? (nextProtocolQuestion(topicRequest) ??
              nextCandidateSafetyQuestion(topicRequest, topicDecision))
            : priorTopic?.pending_question;
        return {
          protocol: topicProtocol,
          normalized: topicNormalized,
          decision: topicDecision,
          question: nextQuestion,
          priorTopic,
          mentionedNow,
        };
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

    if (
      uncertainReply &&
      decision.status === "insufficient" &&
      safety.mode !== "escalate" &&
      card
    ) {
      if (!(
        prior?.asked_slots.includes(uncertainClarificationQuestion.slot) ??
        false
      ))
        decision = askDecision(
          this.pack.packId,
          input,
          context.inventory !== undefined,
          uncertainClarificationQuestion,
          "UNCERTAIN_ANSWER_ALTERNATIVE_ASK",
          card.intent,
        );
    }

    if (decision.status === "insufficient" && decision.intent === null && card)
      decision = noDecision(
        this.pack.packId,
        input,
        context.inventory !== undefined,
        decision.reason_codes,
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

    if (conversationReply)
      decision = noDecision(
        this.pack.packId,
        input,
        context.inventory !== undefined,
        ["CONVERSATION_TURN"],
        null,
      );
    const baseShape: Pick<
      RuntimeOutput,
      "mode" | "status" | "say_now" | "ask_next" | "actions" | "missing_slots"
    > = conversationReply
      ? {
          mode: "instant" as const,
          status: "stable" as const,
          say_now: [conversationReply],
          ask_next: [],
          actions: [],
          missing_slots: [],
        }
      : outputShape(decision, safety);
    const unansweredPriorQuestion =
      pendingAnswer &&
      !pendingAnswer.resolved &&
      !conversationReply &&
      safety.mode === "continue"
        ? (focusPrior?.topics.find(
            (item) => item.protocol_id === focusPrior.active_protocol_id,
          )?.pending_question ?? null)
        : null;
    const primaryTopicQuestion =
      unansweredPriorQuestion ?? progressiveQuestion ?? null;
    const selectedTopicQuestion =
      primaryTopicQuestion ??
      additionalTopicEvaluations.find((item) => item.question)?.question ??
      null;
    const progressiveShape =
      selectedTopicQuestion && baseShape.mode === "instant"
        ? {
            ...baseShape,
            status: "provisional" as const,
            ask_next: [
              {
                question: selectedTopicQuestion.question,
                reason: selectedTopicQuestion.reason,
                priority: 1,
                slot: selectedTopicQuestion.slot,
              },
            ] as [
              {
                question: string;
                reason: string;
                priority: number;
                slot: string;
              },
            ],
            missing_slots: [selectedTopicQuestion.slot],
          }
        : baseShape;
    const shape =
      !conversationReply &&
      card?.cardId.startsWith("CARD-SEED-") &&
      !protocol &&
      decision.status === "ask"
        ? { ...baseShape, say_now: [card.sayNow[0] ?? card.title] as [string] }
        : progressiveShape;
    const partial = input.is_partial || input.input_type === "voice_partial";
    const topScore = protocolCandidate?.score ?? cardCandidate?.score ?? 0;
    const topicResults: TopicResult[] = [
      ...(protocol
        ? [
            {
              protocol_id: protocol.protocol_id,
              intent: protocol.intent,
              symptom_category: protocol.symptom_category,
              decision,
              ask_next: outputQuestion(
                primaryTopicQuestion ??
                  (decision.status === "ask" ? decision.question : null),
              ),
            } satisfies TopicResult,
          ]
        : []),
      ...additionalTopicEvaluations.map((item): TopicResult => ({
        protocol_id: item.protocol.protocol_id,
        intent: item.protocol.intent,
        symptom_category: item.protocol.symptom_category,
        decision: item.decision,
        ask_next: outputQuestion(
          item.question ??
            (item.decision.status === "ask" ? item.decision.question : null),
        ),
      })),
    ];
    const combinedTopicCandidates = topicResults.flatMap((item) => {
      const label =
        item.symptom_category.split("/").at(-1) ?? item.symptom_category;
      const product = item.decision.product_candidates[0];
      const ingredient = item.decision.ingredient_options[0];
      const candidate =
        product?.display_name ??
        (ingredient
          ? `${ingredient.ingredient_name}${ingredient.ingredient_name.endsWith("성분") ? "" : " 성분"}`
          : null);
      return candidate
        ? [`${label}에는 ${withKoreanObjectParticle(candidate)}`]
        : [];
    });
    const combinedTopicNarration =
      topicResults.length > 1
        ? combinedTopicCandidates.length > 0
          ? `말씀하신 증상들을 같이 볼게요. 지금은 ${combinedTopicCandidates.join(", ")} 후보로 볼게요.`
          : "말씀하신 증상들을 같이 볼게요."
        : null;
    const output: RuntimeOutput = {
      request_id: input.request_id,
      session_id: input.session_id,
      sequence: input.sequence,
      ...shape,
      say_now: combinedTopicNarration
        ? [combinedTopicNarration]
        : shape.say_now,
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
      topic_results: topicResults as RuntimeOutput["topic_results"],
      source_refs: [
        ...new Map(
          topicResults
            .flatMap((item) => item.decision.source_refs)
            .map((ref) => [
              `${ref.claim_id}|${ref.source_snapshot_id}|${ref.locator}`,
              ref,
            ]),
        ).values(),
      ],
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
    const topicStateUpdates = new Map<string, ConsultationTopic>();
    for (const topicResult of topicResults) {
      const previous = prior?.topics.find(
        (item) => item.protocol_id === topicResult.protocol_id,
      );
      const additional = additionalTopicEvaluations.find(
        (item) => item.protocol.protocol_id === topicResult.protocol_id,
      );
      const touchedNow =
        topicResult.protocol_id === protocol?.protocol_id ||
        Boolean(additional?.mentionedNow);
      if (previous && !touchedNow) {
        topicStateUpdates.set(topicResult.protocol_id, previous);
        continue;
      }
      const topicNormalized =
        topicResult.protocol_id === protocol?.protocol_id
          ? normalized
          : additional?.normalized;
      const pending = topicResult.ask_next[0] ?? null;
      topicStateUpdates.set(topicResult.protocol_id, {
        protocol_id: topicResult.protocol_id,
        intent: topicResult.intent,
        symptom_category: topicResult.symptom_category,
        answered_slots: {
          ...(previous?.answered_slots ?? {}),
          ...(topicNormalized ? answeredSlotValues(topicNormalized) : {}),
        },
        asked_slots: [
          ...new Set([
            ...(previous?.asked_slots ?? []),
            ...(pending ? [pending.slot] : []),
          ]),
        ],
        pending_question_slot: pending?.slot ?? null,
        pending_question: pending
          ? {
              question: pending.question,
              reason: pending.reason,
              slot: pending.slot,
            }
          : null,
        last_decision_status: topicResult.decision.status,
        updated_at: now.toISOString(),
      });
    }
    const topicStates = [
      ...(prior?.topics ?? []).map(
        (item) => topicStateUpdates.get(item.protocol_id) ?? item,
      ),
      ...topicResults
        .filter(
          (item) =>
            !(prior?.topics ?? []).some(
              (priorTopic) => priorTopic.protocol_id === item.protocol_id,
            ),
        )
        .map((item) => topicStateUpdates.get(item.protocol_id)!),
    ].filter(Boolean);
    const questionOwner = selectedTopicQuestion
      ? topicResults.find((item) =>
          item.ask_next.some(
            (question) => question.question === selectedTopicQuestion.question,
          ),
        )
      : undefined;
    const activeTopic =
      questionOwner ??
      (protocol
        ? topicResults.find((item) => item.protocol_id === protocol.protocol_id)
        : undefined);
    const consultationState = nextConsultationState(prior, {
      sessionId: input.session_id,
      tenantId,
      sequence: input.sequence,
      packId: this.pack.packId,
      protocolId:
        activeTopic?.protocol_id ??
        decision.protocol_id ??
        protocol?.protocol_id ??
        null,
      intent: activeTopic?.intent ?? output.intent,
      symptomCategory: activeTopic?.symptom_category ?? null,
      decision,
      pendingQuestion: selectedTopicQuestion,
      topicStates,
      answeredSlots: answeredSlotValues(normalized),
      now,
    });

    return {
      output,
      ruleIds: [...new Set([...safety.ruleIds, ...decision.reason_codes])],
      externalRefinementAllowed:
        !conversationReply &&
        rawNormalized.safeForExternal &&
        !partial &&
        decision.status !== "refer",
      bypassedDebounce: decision.status === "refer",
      consultationState,
    };
  }
}
