import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  serializeDialogueTurns,
  type DialogueTurn,
} from "@pharmassist/dialogue";
import { isPatientFacingText } from "./consult-memory.js";

const apiBaseUrl = () =>
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  // Production serves /v1/* from the same origin (Vercel functions); local
  // development keeps the standalone API server default.
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8080");

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
}

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
  signal: AbortSignal,
): Promise<AiConversationInterpretation | undefined> {
  const response = await fetch(`${apiBaseUrl()}/v1/consult/interpret`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      text,
      conversation_history: serializeDialogueTurns(
        conversationHistory.slice(-12),
      ),
      previous_intent: previousIntent,
    }),
    signal,
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as Readonly<{
    disposition?: unknown;
    intent?: unknown;
    confidence?: unknown;
    topic_changed?: unknown;
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
    return undefined;
  return {
    disposition:
      body.disposition as AiConversationInterpretation["disposition"],
    intent: typeof body.intent === "string" ? body.intent : null,
    confidence: body.confidence,
    topicChanged: body.topic_changed,
  };
}

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
