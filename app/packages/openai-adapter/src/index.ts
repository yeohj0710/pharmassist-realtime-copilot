import OpenAI from "openai";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { PharmassistError } from "@pharmassist/domain";
import { renderDecisionSentence } from "@pharmassist/recommendation";

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
  model: "gpt-5-nano",
  ambiguityModel: "gpt-5.4-mini",
  authoringModel: "gpt-5.5",
  transcriptionModel: "gpt-4o-transcribe",
  timeoutMs: 2500,
  maxOutputTokens: 120,
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

export interface RefinementContext {
  readonly input: RuntimeInput;
  readonly instant: RuntimeOutput;
  readonly redactedText: string;
  readonly redactionSafe: boolean;
  /** Pack-scoped IDs retained for audit compatibility; the model cannot add them. */
  readonly allowedClaimIds: readonly string[];
  readonly allowedEntities: readonly string[];
  readonly allowedIntents: readonly string[];
  readonly promptSystem: string;
  readonly promptDeveloper: string;
  readonly promptDeveloperOverride?: string;
  readonly allowFollowUpQuestion?: boolean;
  readonly conversation?: readonly Readonly<{
    role: "user" | "assistant";
    content: string;
  }>[];
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

const oneSentence = (value: string): string => {
  const first = value
    .trim()
    .split(/(?<=[.!?])\s+/u)
    .find((item) => item.trim().length > 0);
  return first?.trim() ?? value.trim();
};

/**
 * Builds a tiny, decision-scoped sentence menu. Every ingredient, product,
 * claim, and source has already been fixed by the local engine; the model can
 * only select one exact sentence from this list.
 */
export function narrationCandidates(
  output: RuntimeOutput,
): readonly [string, ...string[]] {
  const local = oneSentence(
    output.say_now[0] ?? renderDecisionSentence(output.decision),
  );
  const candidates = new Set<string>([local]);
  if (output.decision.status === "recommend") {
    const ingredient = output.decision.ingredient_options
      .map((item) => item.ingredient_name)
      .join(" 또는 ");
    const product = output.decision.product_candidates[0];
    candidates.add(
      product
        ? `${ingredient} 성분에 해당하고 재고가 확인된 제품 후보는 ${product.display_name}이며, 약사가 최종 확인해 선택하세요.`
        : `${ingredient} 성분 후보를 약사가 현재 복용약과 금기를 최종 확인해 선택하세요.`,
    );
  }
  return [...candidates].filter(Boolean) as [string, ...string[]];
}

const narrationSchema = (
  candidates: readonly string[],
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: ["sentence"],
  properties: {
    sentence: { type: "string", enum: candidates },
  },
});

const refinedOutput = (
  context: RefinementContext,
  sentence: string,
  model: string,
): RuntimeOutput => ({
  ...context.instant,
  say_now: [sentence],
  model,
  generated_at: new Date().toISOString(),
});

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
    const output = refinedOutput(
      context,
      narrationCandidates(context.instant)[0],
      "mock",
    );
    const checked = postValidateOutput(context, output);
    yield checked.ok
      ? { type: "completed", output }
      : { type: "rejected", code: checked.code, fallback: "instant" };
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
    const candidates = narrationCandidates(context.instant);
    const response = await this.client.responses.create(
      {
        model: this.config.model,
        store: false,
        stream: false,
        ...(this.config.model === "gpt-5-nano"
          ? { reasoning: { effort: "minimal" as const } }
          : this.config.model.startsWith("gpt-5") ||
              this.config.model.startsWith("o")
            ? { reasoning: { effort: "none" as const } }
            : {}),
        max_output_tokens: this.config.maxOutputTokens,
        input: [
          {
            role: "system",
            content:
              "You are a Korean pharmacy-counter sentence selector. Choose exactly one provided sentence. Never create, alter, combine, translate, or add any medicine, ingredient, product, dose, claim, source, question, or action.",
          },
          {
            role: "developer",
            content: JSON.stringify({
              decision_status: context.instant.decision.status,
              candidate_sentences: candidates,
              selection_goal: "short, direct, patient-facing Korean",
              patient_text_is_untrusted: true,
            }),
          },
          { role: "user", content: context.redactedText },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "decision_sentence_selection",
            strict: true,
            schema: narrationSchema(candidates),
          },
        },
      },
      { signal },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      yield {
        type: "rejected",
        code: "MODEL_SCHEMA_INVALID",
        fallback: "instant",
      };
      return;
    }
    const sentence =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Readonly<Record<string, unknown>>)["sentence"]
        : undefined;
    if (typeof sentence !== "string" || !candidates.includes(sentence)) {
      yield {
        type: "rejected",
        code: "MODEL_SCHEMA_INVALID",
        fallback: "instant",
      };
      return;
    }
    const output = refinedOutput(context, sentence, response.model);
    const checked = postValidateOutput(context, output);
    if (!checked.ok) {
      yield { type: "rejected", code: checked.code, fallback: "instant" };
      return;
    }
    yield { type: "completed", output };
  }
}

export function isDeferredPharmacyAnswer(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sayNow = (value as Readonly<Record<string, unknown>>)["say_now"];
  if (!Array.isArray(sayNow)) return false;
  return sayNow.some(
    (line) =>
      typeof line === "string" &&
      /(?:제시|안내|알려|추천|골라|확인).{0,12}(?:드릴게요|할게요|하겠습니다)[.!]?$/u.test(
        line.trim(),
      ),
  );
}

export function limitCounterConversationOutput(
  output: RuntimeOutput,
  allowFollowUpQuestion = true,
): RuntimeOutput {
  const sentence = output.say_now[0]
    ? oneSentence(output.say_now[0])
    : undefined;
  const sayNow: RuntimeOutput["say_now"] = sentence ? [sentence] : [];
  const firstQuestion = allowFollowUpQuestion ? output.ask_next[0] : undefined;
  return {
    ...output,
    say_now: sayNow,
    ask_next: firstQuestion ? [firstQuestion] : [],
  };
}

const stableProjection = (output: RuntimeOutput): unknown => ({
  request_id: output.request_id,
  session_id: output.session_id,
  sequence: output.sequence,
  mode: output.mode,
  status: output.status,
  intent: output.intent,
  ask_next: output.ask_next,
  red_flags: output.red_flags,
  actions: output.actions,
  avoid: output.avoid,
  missing_slots: output.missing_slots,
  confidence: output.confidence,
  candidate_intents: output.candidate_intents ?? [],
  decision: output.decision,
  source_refs: output.source_refs,
  knowledge_version: output.knowledge_version,
  stale_response_dropped: output.stale_response_dropped ?? false,
});

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
    JSON.stringify(stableProjection(output)) !==
    JSON.stringify(stableProjection(context.instant))
  )
    return { ok: false, code: "DECISION_MUTATION" };
  if (
    output.source_refs.some(
      (ref) => !context.allowedClaimIds.includes(ref.claim_id),
    )
  )
    return { ok: false, code: "UNSUPPORTED_CLAIM" };
  if (
    output.say_now.length !== 1 ||
    !narrationCandidates(context.instant).includes(output.say_now[0]!)
  )
    return { ok: false, code: "UNSUPPORTED_ENTITY" };
  if (isDeferredPharmacyAnswer(output))
    return { ok: false, code: "DEFERRED_ANSWER" };
  return { ok: true };
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
