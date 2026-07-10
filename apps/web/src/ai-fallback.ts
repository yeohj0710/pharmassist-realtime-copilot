import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";

const apiBaseUrl = () =>
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  "http://127.0.0.1:8080";

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

export async function requestAiFallback(
  input: RuntimeInput,
  instant: RuntimeOutput,
  signal: AbortSignal,
): Promise<RuntimeOutput | undefined> {
  const response = await fetch(`${apiBaseUrl()}/v1/consult/refine`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-role": "pharmacist",
      "x-tenant": "local-demo",
      "x-user": "local-user",
    },
    body: JSON.stringify({
      runtime_input: input,
      instant_output: instant,
      candidate_card_ids: [],
      knowledge_version: instant.knowledge_version,
    }),
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
    return parsed.output;
  }
  return undefined;
}
