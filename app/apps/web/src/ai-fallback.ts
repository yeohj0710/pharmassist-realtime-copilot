import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { isPatientFacingText } from "./consult-memory.js";

const apiBaseUrl = () =>
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  "http://127.0.0.1:8080";

const authHeaders = (): Readonly<Record<string, string>> => ({
  "content-type": "application/json",
  "x-role": "pharmacist",
  "x-tenant-id": "demo",
  "x-app-passcode": sessionStorage.getItem("pharmassist_access") ?? "",
});

export function shouldRequestAiRefinement(
  online: boolean,
  mode: RuntimeOutput["mode"],
): boolean {
  return online && mode !== "escalate";
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
  conversationHistory: readonly string[],
  signal: AbortSignal,
): Promise<RuntimeOutput | undefined> {
  const instantResponse = await fetch(`${apiBaseUrl()}/v1/consult/instant`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
    signal,
  });
  if (!instantResponse.ok) return undefined;
  const serverInstant = (await instantResponse.json()) as RuntimeOutput;
  if (
    serverInstant.request_id !== input.request_id ||
    serverInstant.session_id !== input.session_id ||
    serverInstant.sequence !== input.sequence ||
    serverInstant.decision.pack_id !== localInstant.decision.pack_id
  )
    return undefined;

  const response = await fetch(`${apiBaseUrl()}/v1/consult/refine`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(
      buildAiRefinementBody(input, serverInstant, conversationHistory),
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
  conversationHistory: readonly string[],
) {
  return {
    runtime_input: input,
    instant_output: instant,
    candidate_card_ids: [],
    conversation_history: conversationHistory.slice(-12),
    knowledge_version: instant.knowledge_version,
  };
}
