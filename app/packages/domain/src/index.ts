import type { RuntimeOutput } from "@pharmassist/contracts";

export type Domain =
  "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine";
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
