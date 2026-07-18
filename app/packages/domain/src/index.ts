import type { RuntimeOutput } from "@pharmassist/contracts";

export type Domain =
  "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine";

const productProtocolProfiles: Readonly<
  Record<string, Readonly<{ indication: RegExp; routeForm: RegExp }>>
> = {
  "PTC-ABDOMINAL_PAIN_VOMITING": {
    indication: /복통|구토|구역|오심/u,
    routeForm: /경구|내용/u,
  },
  "PTC-ACID_REFLUX": {
    indication: /위산|역류|속쓰림|가슴쓰림/u,
    routeForm: /경구|내용/u,
  },
  "PTC-ALLERGIC_RHINITIS": {
    indication: /알레르기성?\s*비염|비염/u,
    routeForm: /경구|내용/u,
  },
  "PTC-BLOATING": {
    indication: /복부\s*팽만|팽만|고창/u,
    routeForm: /경구|내용/u,
  },
  "PTC-CONSTIPATION": {
    indication: /변비/u,
    routeForm: /경구|내용|항문|직장|좌제/u,
  },
  "PTC-DIARRHEA": { indication: /설사/u, routeForm: /경구|내용/u },
  "PTC-DRY_COUGH": {
    indication: /마른\s*기침|기침|진해/u,
    routeForm: /경구|내용/u,
  },
  "PTC-DRY_EYE": {
    indication: /안구\s*건조|눈의\s*건조|인공눈물|각결막/u,
    routeForm: /눈|점안/u,
  },
  "PTC-FEVER": {
    indication: /발열|해열|열을\s*내/u,
    routeForm: /경구|내용|항문|직장|좌제/u,
  },
  "PTC-GAS": {
    indication: /가스|고창|복부\s*팽만/u,
    routeForm: /경구|내용/u,
  },
  "PTC-HEADACHE": {
    indication: /두통|머리\s*(?:통증|아픔)/u,
    routeForm: /경구|내용/u,
  },
  "PTC-HEARTBURN": {
    indication: /속쓰림|가슴쓰림|위산과다/u,
    routeForm: /경구|내용/u,
  },
  "PTC-INDIGESTION": {
    indication: /소화불량|과식|식욕감퇴|소화촉진/u,
    routeForm: /경구|내용/u,
  },
  "PTC-INSECT_BITE": {
    indication: /벌레|곤충|자상|물림/u,
    routeForm: /경구|내용|피부|외용|경피/u,
  },
  "PTC-JOINT_PAIN": {
    indication: /관절통|관절염|삠|염좌/u,
    routeForm: /경구|내용|피부|외용|경피/u,
  },
  "PTC-MENSTRUAL_PAIN": {
    indication: /생리통|월경통/u,
    routeForm: /경구|내용/u,
  },
  "PTC-MILD_DERMATITIS": {
    indication: /피부염|습진|가려움|소양/u,
    routeForm: /피부|외용|경피/u,
  },
  "PTC-MINOR_WOUND": {
    indication: /상처|창상|화상|살균|소독/u,
    routeForm: /피부|외용|경피/u,
  },
  "PTC-MOTION_SICKNESS": {
    indication: /멀미|구역|구토|어지러움/u,
    routeForm: /경구|내용/u,
  },
  "PTC-MUSCLE_PAIN": {
    indication: /근육통|근육|요통|신경통/u,
    routeForm: /경구|내용|피부|외용|경피/u,
  },
  "PTC-NASAL_CONGESTION": {
    indication: /코막힘|비충혈|비염/u,
    routeForm: /경구|내용|코|비강|비강용/u,
  },
  "PTC-PRODUCTIVE_COUGH": {
    indication: /가래|객담|거담|점액/u,
    routeForm: /경구|내용/u,
  },
  "PTC-RUNNY_NOSE": {
    indication: /콧물|비염|재채기/u,
    routeForm: /경구|내용|코|비강|비강용/u,
  },
  "PTC-SORE_THROAT": {
    indication: /인후|목의\s*통증|인두염|편도염/u,
    routeForm: /경구|내용|구강|인후|트로키/u,
  },
  "PTC-STOMATITIS": {
    indication: /구내염|아프타|혀의\s*염증/u,
    routeForm: /구강|치아|구강용|인후/u,
  },
  "PTC-URTICARIA_ITCH": {
    indication: /두드러기|소양|가려움/u,
    routeForm: /경구|내용|피부|외용|경피/u,
  },
};

export const productProtocolProfileIds = Object.freeze(
  Object.keys(productProtocolProfiles).sort(),
);

export function matchesProductProtocolProfile(
  protocolId: string,
  indication: string | null | undefined,
  route: string | null | undefined,
  dosageForm: string | null | undefined,
): boolean {
  const profile = productProtocolProfiles[protocolId];
  return Boolean(
    profile &&
    indication &&
    profile.indication.test(indication) &&
    profile.routeForm.test(`${route ?? ""} ${dosageForm ?? ""}`),
  );
}
export type EvidenceState = "positive" | "negative" | "uncertain";
export type PersonScope = "self" | "child" | "family" | "other" | "unknown";
export type Temporality = "current" | "past" | "possible" | "unknown";

export interface SlotEvidence<T = unknown> {
  readonly value: T;
  readonly provenance: "typed" | "voice" | "context" | "derived";
  readonly confidence: number;
  readonly verified: boolean;
  readonly span?: readonly [number, number];
}

export interface RedactionFinding {
  readonly kind:
    "phone" | "email" | "rrn" | "address" | "payment" | "possible_name";
  readonly start: number;
  readonly end: number;
}

export interface NormalizedInput {
  readonly displayText: string;
  readonly normalizedText: string;
  readonly redactedText: string;
  readonly safeForExternal: boolean;
  readonly findings: readonly RedactionFinding[];
  readonly alternatives: readonly string[];
  readonly tokens: readonly string[];
  readonly slots: Readonly<Record<string, SlotEvidence>>;
  readonly personScope: PersonScope;
  readonly temporality: Temporality;
}

export interface MatchFeature {
  readonly kind: "exact" | "trie" | "rule" | "bm25" | "trigram" | "slot";
  readonly value: number;
  readonly explanation: string;
}

export interface Candidate {
  readonly cardId: string;
  readonly intent: string;
  readonly score: number;
  readonly features: readonly MatchFeature[];
}

export interface SafetyDecision {
  readonly mode: "continue" | "clarify" | "escalate" | "no_match";
  readonly ruleIds: readonly string[];
  readonly redFlags: RuntimeOutput["red_flags"];
  readonly missingSlots: readonly string[];
  readonly sayNow: readonly string[];
  readonly askNext?: Readonly<{
    question: string;
    reason: string;
    priority: number;
    slot: string;
  }>;
  readonly lockCritical: boolean;
}

export type SafeFallback =
  "instant" | "typed_input" | "clarify_or_refer" | "previous_pack" | "none";
export type ErrorCode =
  | "INVALID_INPUT"
  | "DOMAIN_DISABLED"
  | "KNOWLEDGE_STALE"
  | "CARD_REVOKED"
  | "MISSING_BLOCKING_SLOT"
  | "PRODUCT_AMBIGUOUS"
  | "UNSUPPORTED_CLAIM"
  | "MODEL_SCHEMA_INVALID"
  | "MODEL_TIMEOUT"
  | "REALTIME_UNAVAILABLE"
  | "STALE_SEQUENCE"
  | "RATE_LIMITED"
  | "PRIVACY_REDACTION_FAILED"
  | "FORBIDDEN"
  | "INTERNAL_SAFE_FAILURE";

export class PharmassistError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly safeFallback: SafeFallback,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "PharmassistError";
  }
}

export interface Clock {
  now(): Date;
  monotonicMs(): number;
}
export const systemClock: Clock = {
  now: () => new Date(),
  monotonicMs: () => performance.now(),
};

export interface SessionState {
  readonly sessionId: string;
  readonly sequence: number;
  readonly frozen: boolean;
  readonly criticalLocked: boolean;
  readonly acknowledged: boolean;
  readonly currentCardId?: string;
}

export type SessionEvent =
  | { readonly type: "INPUT"; readonly sequence: number }
  | { readonly type: "SELECT_CARD"; readonly cardId: string }
  | { readonly type: "FREEZE" }
  | { readonly type: "UNFREEZE" }
  | { readonly type: "CRITICAL_LOCK"; readonly cardId: string }
  | { readonly type: "ACKNOWLEDGE_CRITICAL" }
  | { readonly type: "CLEAR" };

export function reduceSession(
  state: SessionState,
  event: SessionEvent,
): SessionState {
  switch (event.type) {
    case "INPUT":
      return event.sequence <= state.sequence
        ? state
        : { ...state, sequence: event.sequence, acknowledged: false };
    case "SELECT_CARD":
      return state.criticalLocked && !state.acknowledged
        ? state
        : { ...state, currentCardId: event.cardId, frozen: true };
    case "FREEZE":
      return { ...state, frozen: true };
    case "UNFREEZE":
      return state.criticalLocked && !state.acknowledged
        ? state
        : { ...state, frozen: false };
    case "CRITICAL_LOCK":
      return {
        ...state,
        criticalLocked: true,
        acknowledged: false,
        frozen: true,
        currentCardId: event.cardId,
      };
    case "ACKNOWLEDGE_CRITICAL":
      return { ...state, criticalLocked: false, acknowledged: true };
    case "CLEAR":
      return {
        sessionId: state.sessionId,
        sequence: state.sequence + 1,
        frozen: false,
        criticalLocked: false,
        acknowledged: false,
      };
  }
}

export function isStale(
  current: Readonly<Pick<SessionState, "sequence">>,
  incomingSequence: number,
): boolean {
  return incomingSequence !== current.sequence;
}
