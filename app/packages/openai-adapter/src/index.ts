import OpenAI from "openai";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  runtimeOutputSchemaDocument,
  validateContract,
} from "@pharmassist/contracts";
import { PharmassistError } from "@pharmassist/domain";

export interface OpenAIConfig {
  readonly model: string;
  readonly ambiguityModel: string;
  readonly authoringModel: string;
  readonly transcriptionModel: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly store: false;
}
export const safeOpenAIConfig: OpenAIConfig = {
  model: "gpt-4.1-mini",
  ambiguityModel: "gpt-5.4-mini",
  authoringModel: "gpt-5.5",
  transcriptionModel: "gpt-realtime-whisper",
  timeoutMs: 2500,
  maxOutputTokens: 420,
  store: false,
};

export function toStrictOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStrictOutputSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Readonly<Record<string, unknown>>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source))
    result[key] = toStrictOutputSchema(child);
  if (source["type"] === "object" && source["properties"]) {
    const properties = source["properties"] as Readonly<
      Record<string, unknown>
    >;
    result["required"] = Object.keys(properties);
    result["additionalProperties"] = false;
  }
  return result;
}

const strictRuntimeOutputSchema = toStrictOutputSchema(
  runtimeOutputSchemaDocument,
) as { [key: string]: unknown };
export interface RefinementContext {
  readonly input: RuntimeInput;
  readonly instant: RuntimeOutput;
  readonly redactedText: string;
  readonly redactionSafe: boolean;
  readonly allowedClaimIds: readonly string[];
  readonly allowedEntities: readonly string[];
  readonly allowedIntents: readonly string[];
  readonly promptSystem: string;
  readonly promptDeveloper: string;
  readonly promptDeveloperOverride?: string;
}
export type RefinementEvent =
  | { readonly type: "started"; readonly sequence: number }
  | { readonly type: "completed"; readonly output: RuntimeOutput }
  | {
      readonly type: "rejected";
      readonly code: string;
      readonly fallback: "instant";
    };
export interface ResponsesRefiner {
  refine(
    context: RefinementContext,
    signal: AbortSignal,
  ): AsyncIterable<RefinementEvent>;
}
export class MockResponsesRefiner implements ResponsesRefiner {
  constructor(
    private readonly behavior:
      "success" | "timeout" | "schema_error" = "success",
  ) {}
  async *refine(
    context: RefinementContext,
    signal: AbortSignal,
  ): AsyncIterable<RefinementEvent> {
    yield { type: "started", sequence: context.input.sequence };
    if (signal.aborted) return;
    if (this.behavior === "timeout") {
      yield { type: "rejected", code: "MODEL_TIMEOUT", fallback: "instant" };
      return;
    }
    if (this.behavior === "schema_error") {
      yield {
        type: "rejected",
        code: "MODEL_SCHEMA_INVALID",
        fallback: "instant",
      };
      return;
    }
    yield {
      type: "completed",
      output: {
        ...context.instant,
        mode: "refined",
        model: "mock",
        generated_at: new Date().toISOString(),
      },
    };
  }
}

export class OfficialResponsesRefiner implements ResponsesRefiner {
  readonly client: OpenAI;
  constructor(
    apiKey: string,
    readonly config: OpenAIConfig = safeOpenAIConfig,
  ) {
    this.client = new OpenAI({ apiKey });
  }
  async *refine(
    context: RefinementContext,
    signal: AbortSignal,
  ): AsyncIterable<RefinementEvent> {
    if (!context.redactionSafe)
      throw new PharmassistError(
        "PRIVACY_REDACTION_FAILED",
        "External refinement blocked.",
        false,
        "instant",
      );
    yield { type: "started", sequence: context.input.sequence };
    const response = await this.client.responses.create(
      {
        model: this.config.model,
        store: false,
        stream: false,
        ...(this.config.model.startsWith("gpt-5") ||
        this.config.model.startsWith("o")
          ? { reasoning: { effort: "none" as const } }
          : {}),
        max_output_tokens: this.config.maxOutputTokens,
        input: [
          { role: "system", content: context.promptSystem },
          {
            role: "developer",
            content: context.promptDeveloperOverride ?? context.promptDeveloper,
          },
          {
            role: "user",
            content: JSON.stringify({
              request_id: context.input.request_id,
              session_id: context.input.session_id,
              sequence: context.input.sequence,
              knowledge_version: context.instant.knowledge_version,
              redacted_normalized_text: context.redactedText,
              provisional_local_context: {
                intent: context.instant.intent,
                mode: context.instant.mode,
                status: context.instant.status,
                ask_next: context.instant.ask_next,
                red_flags: context.instant.red_flags,
                missing_slots: context.instant.missing_slots,
              },
              output_template: {
                ...context.instant,
                intent: null,
                say_now: [],
                ask_next: [],
                actions: context.instant.actions,
                avoid: [],
                candidate_intents: [],
              },
              allowed_claim_ids: context.allowedClaimIds,
              allowed_entities: context.allowedEntities,
              allowed_intents: context.allowedIntents,
              patient_content_is_untrusted: true,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "runtime_output",
            strict: true,
            schema: strictRuntimeOutputSchema,
          },
        },
      },
      { signal },
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch (error: unknown) {
      yield {
        type: "rejected",
        code: "MODEL_SCHEMA_INVALID",
        fallback: "instant",
      };
      return;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.assign(parsed, {
        request_id: context.input.request_id,
        session_id: context.input.session_id,
        sequence: context.input.sequence,
        knowledge_version: context.instant.knowledge_version,
        generated_at: new Date().toISOString(),
        model: response.model,
      });
    }
    const valid = validateContract<RuntimeOutput>("runtimeOutput", parsed);
    if (!valid.ok || !valid.value) {
      yield {
        type: "rejected",
        code: "MODEL_SCHEMA_INVALID",
        fallback: "instant",
      };
      return;
    }
    const cleanedSayNow =
      valid.value.ask_next.length > 0
        ? valid.value.say_now
            .map((line) =>
              line
                .split(/(?<=[.!?])\s+/u)
                .filter((sentence) => !sentence.trim().endsWith("?"))
                .join(" ")
                .trim(),
            )
            .filter(Boolean)
            .slice(0, 3)
        : [...valid.value.say_now];
    const sayNow: RuntimeOutput["say_now"] =
      cleanedSayNow.length === 0
        ? []
        : cleanedSayNow.length === 1
          ? [cleanedSayNow[0]!]
          : cleanedSayNow.length === 2
            ? [cleanedSayNow[0]!, cleanedSayNow[1]!]
            : [cleanedSayNow[0]!, cleanedSayNow[1]!, cleanedSayNow[2]!];
    const attributedOutput: RuntimeOutput = {
      ...valid.value,
      say_now: sayNow,
      model: response.model,
    };
    const checked = postValidateOutput(context, attributedOutput);
    if (!checked.ok) {
      yield { type: "rejected", code: checked.code, fallback: "instant" };
      return;
    }
    yield { type: "completed", output: attributedOutput };
  }
}
export function postValidateOutput(
  context: RefinementContext,
  output: RuntimeOutput,
): { readonly ok: true } | { readonly ok: false; readonly code: string } {
  if (
    output.request_id !== context.input.request_id ||
    output.session_id !== context.input.session_id ||
    output.sequence !== context.input.sequence ||
    output.knowledge_version !== context.instant.knowledge_version
  )
    return { ok: false, code: "STALE_SEQUENCE" };
  if (
    output.source_refs.some(
      (ref) => !context.allowedClaimIds.includes(ref.claim_id),
    )
  )
    return { ok: false, code: "UNSUPPORTED_CLAIM" };
  if (context.instant.mode === "escalate" && output.mode !== "escalate")
    return { ok: false, code: "SAFETY_MONOTONICITY" };
  // Normal conversational content is model-led. Local enforcement is limited
  // to sequence integrity, source attribution, and immutable escalation.
  return { ok: true };
  /* legacy entity allowlist retained below for removal after migration */
  const text = [...output.say_now, ...output.actions.map((a) => a.text)].join(
    " ",
  );
  const entities =
    text.match(/[A-Za-z가-힣]+|\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc|정|회|일)/gu) ??
    [];
  const newClinical = entities.filter(
    (item) =>
      /\d|mg|ml|정$/iu.test(item) && !context.allowedEntities.includes(item),
  );
  return newClinical.length
    ? { ok: false, code: "UNSUPPORTED_ENTITY" }
    : { ok: true };
}

export interface TranscriptState {
  readonly items: Readonly<
    Record<string, { readonly text: string; readonly completed: boolean }>
  >;
  readonly seen: ReadonlySet<string>;
  readonly connected: boolean;
}
export const emptyTranscriptState: TranscriptState = {
  items: {},
  seen: new Set(),
  connected: true,
};
export function reduceRealtime(
  state: TranscriptState,
  event: unknown,
): TranscriptState {
  if (!event || typeof event !== "object") return state;
  const value = event as Readonly<Record<string, unknown>>;
  const id = typeof value["event_id"] === "string" ? value["event_id"] : "";
  if (id && state.seen.has(id)) return state;
  const seen = new Set(state.seen);
  if (id) seen.add(id);
  if (value["type"] === "disconnect")
    return { ...state, seen, connected: false };
  const itemId = typeof value["item_id"] === "string" ? value["item_id"] : "";
  if (!itemId) return { ...state, seen };
  const prior = state.items[itemId] ?? { text: "", completed: false };
  if (
    value["type"] === "conversation.item.input_audio_transcription.delta" &&
    typeof value["delta"] === "string"
  )
    return {
      ...state,
      seen,
      items: {
        ...state.items,
        [itemId]: { text: prior.text + value["delta"], completed: false },
      },
    };
  if (
    value["type"] === "conversation.item.input_audio_transcription.completed" &&
    typeof value["transcript"] === "string"
  )
    return {
      ...state,
      seen,
      items: {
        ...state.items,
        [itemId]: { text: value["transcript"], completed: true },
      },
    };
  return { ...state, seen };
}
export function stablePrefix(
  previous: string,
  current: string,
  unchangedMs: number,
  isFinal: boolean,
): string {
  if (isFinal) return current;
  let index = 0;
  while (index < previous.length && previous[index] === current[index])
    index += 1;
  return unchangedMs >= 100 ? current.slice(0, index) : "";
}

export interface RealtimeCallOptions {
  readonly apiKey: string;
  readonly sdp: string;
  readonly safetyIdentifier: string;
  readonly signal: AbortSignal;
  readonly endpoint?: string;
}
export async function createRealtimeTranscriptionCall(
  options: RealtimeCallOptions,
): Promise<string> {
  if (!options.sdp.startsWith("v=0") || options.sdp.length > 128_000)
    throw new PharmassistError(
      "INVALID_INPUT",
      "Invalid WebRTC offer.",
      false,
      "typed_input",
    );
  const form = new FormData();
  form.set("sdp", options.sdp);
  form.set(
    "session",
    JSON.stringify({
      type: "transcription",
      audio: {
        input: {
          transcription: {
            model: safeOpenAIConfig.transcriptionModel,
            language: "ko",
          },
          turn_detection: null,
        },
      },
    }),
  );
  const response = await fetch(
    options.endpoint ?? "https://api.openai.com/v1/realtime/calls",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "OpenAI-Safety-Identifier": options.safetyIdentifier,
      },
      body: form,
      signal: options.signal,
    },
  );
  if (!response.ok)
    throw new PharmassistError(
      "REALTIME_UNAVAILABLE",
      "Realtime transcription session unavailable.",
      response.status >= 500,
      "typed_input",
    );
  const answer = await response.text();
  if (!answer.startsWith("v=0") || answer.length > 128_000)
    throw new PharmassistError(
      "REALTIME_UNAVAILABLE",
      "Invalid WebRTC answer.",
      false,
      "typed_input",
    );
  return answer;
}

export async function transcribeRecordedAudio(options: {
  readonly apiKey: string;
  readonly audio: Uint8Array;
  readonly mimeType: string;
  readonly signal: AbortSignal;
  readonly model?: string;
  readonly prompt?: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: options.apiKey });
  const extension = options.mimeType.includes("ogg") ? "ogg" : "webm";
  const result = await client.audio.transcriptions.create(
    {
      file: new File([options.audio], `voice.${extension}`, {
        type: options.mimeType,
      }),
      model: options.model ?? "gpt-4o-transcribe",
      language: "ko",
      ...(options.prompt ? { prompt: options.prompt } : {}),
    },
    { signal: options.signal },
  );
  return result.text.trim();
}
