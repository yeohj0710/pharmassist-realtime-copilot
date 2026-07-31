import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  serializeDialogueTurns,
  type DialogueTurn,
} from "@pharmassist/dialogue";
import { isPatientFacingText } from "./consult-memory.js";

const loopbackUrl = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?:[:/]|$)/u;

// The repo-root .env carries the local dev API address (and can even carry
// NODE_ENV=development, which flips Vite's PROD flag on a production build),
// so build-time flags cannot be trusted here. The page origin is the runtime
// truth: a page that is not itself on loopback must never call the visitor's
// loopback and uses the same origin (Vercel functions) instead.
const apiBaseUrl = (): string => {
  const configured = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
  const pageOnLoopback =
    typeof window === "undefined" || loopbackUrl.test(window.location.origin);
  if (configured && (pageOnLoopback || !loopbackUrl.test(configured)))
    return configured;
  return pageOnLoopback ? "http://127.0.0.1:8080" : "";
};

const authHeaders = (): Readonly<Record<string, string>> => ({
  "content-type": "application/json",
  "x-role": "pharmacist",
  "x-tenant-id": "demo",
  "x-app-passcode": sessionStorage.getItem("pharmassist_access") ?? "",
});

export function shouldRequestAiRefinement(
  online: boolean,
  mode: RuntimeOutput["mode"],
  decisionStatus: RuntimeOutput["decision"]["status"],
): boolean {
  return online && mode !== "escalate" && decisionStatus === "recommend";
}

export interface AiConversationInterpretation {
  readonly disposition:
    "clinical_intent" | "answer_or_detail" | "conversation_only" | "unclear";
  readonly intent: string | null;
  readonly confidence: number;
  readonly topicChanged: boolean;
  /** Whether the turn answers the counselor question that is still open. */
  readonly answersPendingQuestion: boolean;
  /**
   * Which pack-defined branch the answer means, when the open question
   * carried options — the select-rule key, or null when none fits.
   */
  readonly answerOptionKey: string | null;
  /**
   * Every offered branch — across all fact targets, not only the open
   * question — whose meaning the customer's turn states.
   */
  readonly answerOptionKeys: readonly string[];
}

/** A branch question the consultation can act on, with its options. */
export interface ConsultationFactTarget {
  readonly slot: string;
  readonly question: string;
  readonly options: readonly PendingQuestionOption[];
}

/** A pack-defined branch of the open question the model may choose. */
export interface PendingQuestionOption {
  readonly key: string;
  readonly phrases: readonly string[];
}

/** The counselor question the customer is replying to, if one is open. */
export interface PendingCounselorQuestion {
  readonly question: string;
  readonly slot: string;
  readonly options: readonly PendingQuestionOption[];
}

/**
 * What a single interpretation attempt proved about the service, kept apart
 * from what it produced: the readiness probe only sees that a key is
 * configured, so a real call is the only evidence that AI actually answers.
 */
export type AiInterpretationOutcome =
  | {
      readonly status: "interpreted";
      readonly interpretation: AiConversationInterpretation;
    }
  /** Answered, but the answer was unusable — the service itself is alive. */
  | { readonly status: "rejected" }
  /** Could not answer at all: missing key, exhausted quota, dead function. */
  | { readonly status: "unavailable" };

// Rejections caused by this particular turn, and a model answer that missed
// the schema, say nothing about whether AI is reachable. Every other failure
// would repeat on the next turn too, so it counts against availability. Both
// backends share these codes; the API adds KNOWLEDGE_STALE and MODEL_TIMEOUT,
// which are deliberately left out — a turn that got no answer is reported as
// no answer, and the badge recovers on the next call that does succeed.
const turnSpecificFailures: ReadonlySet<string> = new Set([
  "INVALID_INPUT",
  "PRIVACY_REDACTION_FAILED",
  "MODEL_SCHEMA_INVALID",
]);

export const failureLeavesAiAvailable = (errorCode: unknown): boolean =>
  typeof errorCode === "string" && turnSpecificFailures.has(errorCode);

/**
 * A pending question only survives into the next turn while the consultation
 * is still on it, so the answer hint is derived from the visible question
 * rather than from anything the model chooses.
 */
export const pendingCounselorQuestion = (
  output: RuntimeOutput | undefined,
): PendingCounselorQuestion | undefined => {
  const question = output?.ask_next[0];
  return question
    ? {
        question: question.question,
        slot: question.slot,
        options: (question.options ?? []).map((option) => ({
          key: option.key,
          phrases: [...option.phrases],
        })),
      }
    : undefined;
};

export const shouldBypassAiInterpretation = (text: string): boolean => {
  return /(?:숨(?:이|쉬기).*(?:안|힘)|입술.*파래|가슴.*(?:짓눌|식은땀)|의식.*(?:없|흐려)|피를\s*(?:토|쌌|봄)|검은\s*변|마비|말이\s*안\s*나|119|과다\s*복용)/u.test(
    text,
  );
};

export const shouldInterpretWithAi = (
  aiReady: boolean,
  online: boolean,
  text: string,
): boolean => aiReady && online && !shouldBypassAiInterpretation(text);

export async function requestAiInterpretation(
  text: string,
  conversationHistory: readonly DialogueTurn[],
  previousIntent: string | null,
  pendingQuestion: PendingCounselorQuestion | undefined,
  factTargets: readonly ConsultationFactTarget[],
  signal: AbortSignal,
): Promise<AiInterpretationOutcome> {
  const response = await fetch(`${apiBaseUrl()}/v1/consult/interpret`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      text,
      conversation_history: serializeDialogueTurns(
        conversationHistory.slice(-12),
      ),
      previous_intent: previousIntent,
      ...(pendingQuestion
        ? {
            pending_question: pendingQuestion.question,
            ...(pendingQuestion.options.length > 0
              ? {
                  pending_options: pendingQuestion.options.map((option) => ({
                    key: option.key,
                    phrases: [...option.phrases],
                  })),
                }
              : {}),
          }
        : {}),
      ...(factTargets.length > 0
        ? {
            fact_targets: factTargets.map((target) => ({
              slot: target.slot,
              question: target.question,
              options: target.options.map((option) => ({
                key: option.key,
                phrases: [...option.phrases],
              })),
            })),
          }
        : {}),
    }),
    signal,
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as Readonly<{
      error?: Readonly<{ code?: unknown }>;
    }>;
    return failureLeavesAiAvailable(failure.error?.code)
      ? { status: "rejected" }
      : { status: "unavailable" };
  }
  const body = (await response.json()) as Readonly<{
    disposition?: unknown;
    intent?: unknown;
    confidence?: unknown;
    topic_changed?: unknown;
    answers_pending_question?: unknown;
    answer_option_key?: unknown;
    chosen_option_keys?: unknown;
  }>;
  const dispositions = new Set([
    "clinical_intent",
    "answer_or_detail",
    "conversation_only",
    "unclear",
  ]);
  const clinicalIntent = body.disposition === "clinical_intent";
  if (
    typeof body.disposition !== "string" ||
    !dispositions.has(body.disposition) ||
    (clinicalIntent ? typeof body.intent !== "string" : body.intent !== null) ||
    typeof body.confidence !== "number" ||
    body.confidence < 0 ||
    body.confidence > 1 ||
    typeof body.topic_changed !== "boolean"
  )
    return { status: "rejected" };
  // Only keys the engine offered this very turn are usable; the model
  // cannot introduce its own.
  const offeredKeys = new Set([
    ...(pendingQuestion?.options ?? []).map((option) => option.key),
    ...factTargets.flatMap((target) =>
      target.options.map((option) => option.key),
    ),
  ]);
  return {
    status: "interpreted",
    interpretation: {
      disposition:
        body.disposition as AiConversationInterpretation["disposition"],
      intent: typeof body.intent === "string" ? body.intent : null,
      confidence: body.confidence,
      topicChanged: body.topic_changed,
      answersPendingQuestion: body.answers_pending_question === true,
      answerOptionKey:
        typeof body.answer_option_key === "string" &&
        offeredKeys.has(body.answer_option_key)
          ? body.answer_option_key
          : null,
      answerOptionKeys: Array.isArray(body.chosen_option_keys)
        ? [
            ...new Set(
              body.chosen_option_keys.filter(
                (key): key is string =>
                  typeof key === "string" && offeredKeys.has(key),
              ),
            ),
          ].slice(0, 4)
        : [],
    },
  };
}

/**
 * All branches the customer's turn stated, under the fact gate: the turn
 * stayed on topic and the read is confident. Unlike the answered slot this
 * does not require the turn to answer the open question — a stated fact
 * counts wherever it lands. The engine re-validates every key against the
 * active protocol's select rules before acting.
 */
export const statedFactKeysFromInterpretation = (
  interpretation: AiConversationInterpretation,
): readonly string[] =>
  !interpretation.topicChanged && interpretation.confidence >= 0.45
    ? interpretation.answerOptionKeys
    : [];

export const interpretedIntent = (
  interpretation: AiConversationInterpretation,
): string | undefined =>
  interpretation.disposition === "clinical_intent" &&
  interpretation.intent &&
  interpretation.confidence >= 0.45
    ? interpretation.intent
    : undefined;

/**
 * Asks the model to write the counselor's next turn. Everything it may say is
 * supplied by the engine and re-checked by the referee before display, so a
 * missing or refused composition costs nothing but the engine's own wording.
 */
export async function requestComposedCounselorTurn(
  conversationHistory: readonly DialogueTurn[],
  boundary: Readonly<{
    engineLine: string;
    verifiedProducts: readonly string[];
    productGuidance: readonly Readonly<{
      name: string;
      chooseWhen: string;
      differentiators: readonly string[];
    }>[];
    combinationGuidance: readonly Readonly<{
      primary: string;
      supportive: string;
      rationale: string;
    }>[];
    verifiedIngredients: readonly string[];
    knownFacts: readonly string[];
    referralRequired: boolean;
  }>,
  signal: AbortSignal,
): Promise<Readonly<{ say: string; ask: string | null }> | undefined> {
  const response = await fetch(`${apiBaseUrl()}/v1/consult/compose`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      conversation_history: serializeDialogueTurns(
        conversationHistory.slice(-12),
      ),
      engine_line: boundary.engineLine,
      verified_products: [...boundary.verifiedProducts],
      product_guidance: boundary.productGuidance.map((item) => ({
        name: item.name,
        choose_when: item.chooseWhen,
        differentiators: [...item.differentiators],
      })),
      combination_guidance: [...boundary.combinationGuidance],
      verified_ingredients: [...boundary.verifiedIngredients],
      known_facts: [...boundary.knownFacts],
      referral_required: boundary.referralRequired,
    }),
    signal,
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as Readonly<{
    say?: unknown;
    ask?: unknown;
  }>;
  if (typeof body.say !== "string") return undefined;
  return {
    say: body.say,
    ask: typeof body.ask === "string" && body.ask ? body.ask : null,
  };
}

/**
 * Proves only that a key is configured and the feature is on — not that the
 * upstream will answer. An exhausted quota reports ready here while failing
 * every call, so the badge also needs the outcome of real interpretations.
 */
export async function requestAiReadiness(
  signal: AbortSignal,
): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl()}/v1/health/ready`, { signal });
  if (!response.ok) return false;
  const body = (await response.json()) as Readonly<{
    components?: Readonly<{ openai_responses?: string }>;
  }>;
  return body.components?.openai_responses === "ready";
}

/**
 * The browser worker remains the offline source of the immediate decision.
 * Before optional narration, the API independently executes and stores the
 * same turn. Only that server-issued RuntimeOutput can cross the LLM boundary.
 */
export async function requestAiFallback(
  input: RuntimeInput,
  localInstant: RuntimeOutput,
  conversationHistory: readonly DialogueTurn[],
  signal: AbortSignal,
): Promise<RuntimeOutput | undefined> {
  const response = await fetch(`${apiBaseUrl()}/v1/consult/refine`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(
      buildAiRefinementBody(input, localInstant, conversationHistory),
    ),
    signal,
  });
  if (!response.ok) return undefined;
  const payload = await response.text();
  for (const block of payload.split(/\n\n/gu)) {
    if (!block.startsWith("event: refinement.completed")) continue;
    const data = block
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) continue;
    const parsed = JSON.parse(data) as Readonly<{ output?: RuntimeOutput }>;
    if (
      parsed.output &&
      [
        ...parsed.output.say_now,
        ...parsed.output.ask_next.map((item) => item.question),
      ].every(isPatientFacingText)
    )
      return parsed.output;
    return undefined;
  }
  return undefined;
}

export function buildAiRefinementBody(
  input: RuntimeInput,
  instant: RuntimeOutput,
  conversationHistory: readonly DialogueTurn[],
) {
  return {
    runtime_input: input,
    instant_output: instant,
    candidate_card_ids: [],
    conversation_history: serializeDialogueTurns(
      conversationHistory.slice(-12),
    ),
    knowledge_version: instant.knowledge_version,
  };
}
