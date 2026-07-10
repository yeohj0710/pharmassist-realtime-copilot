import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { describe, expect, it } from "vitest";
import {
  createRealtimeTranscriptionCall,
  emptyTranscriptState,
  MockResponsesRefiner,
  postValidateOutput,
  reduceRealtime,
  safeOpenAIConfig,
  stablePrefix,
  toStrictOutputSchema,
} from "./index.js";

const base: RuntimeOutput = {
  request_id: "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349",
  session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  sequence: 2,
  mode: "clarify",
  status: "blocked",
  intent: null,
  say_now: [],
  ask_next: [],
  red_flags: [],
  actions: [],
  avoid: [],
  missing_slots: ["product"],
  confidence: 1,
  source_refs: [],
  latency: {
    total_ms: 1,
    normalize_ms: 1,
    safety_ms: 0,
    retrieve_ms: 0,
    refine_ms: 0,
  },
  knowledge_version: "v",
  generated_at: "2026-07-10T00:00:00Z",
};
const input: RuntimeInput = {
  request_id: base.request_id,
  session_id: base.session_id,
  sequence: 2,
  input_type: "typed",
  text: "x",
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: base.generated_at,
};
const context = {
  input,
  instant: base,
  redactedText: "x",
  redactionSafe: true,
  allowedClaimIds: [],
  allowedEntities: [],
  allowedIntents: ["test_intent"],
  promptSystem: "s",
  promptDeveloper: "d",
};

describe("OpenAI boundaries", () => {
  it("converts nested objects to strict structured-output schemas", () => {
    const strict = toStrictOutputSchema({
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: { optional: { type: "string" } },
        },
      },
    }) as Readonly<Record<string, unknown>>;
    expect(strict["required"]).toEqual(["nested"]);
    expect(
      (strict["properties"] as Record<string, Record<string, unknown>>)[
        "nested"
      ]?.["required"],
    ).toEqual(["optional"]);
  });
  it("pins store false", () => expect(safeOpenAIConfig.store).toBe(false));
  it("mock falls back deterministically", async () => {
    const events = [];
    for await (const event of new MockResponsesRefiner("timeout").refine(
      context,
      new AbortController().signal,
    ))
      events.push(event);
    expect(events.at(-1)?.type).toBe("rejected");
  });
  it("rejects safety downgrade", () =>
    expect(
      postValidateOutput(
        { ...context, instant: { ...base, mode: "escalate" } },
        { ...base, mode: "refined" },
      ).ok,
    ).toBe(false));
  it("reduces duplicate events and stable prefixes", () => {
    const one = reduceRealtime(emptyTranscriptState, {
      event_id: "1",
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "i",
      delta: "기침",
    });
    expect(
      reduceRealtime(one, {
        event_id: "1",
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "i",
        delta: "약",
      }).items["i"]?.text,
    ).toBe("기침");
    expect(stablePrefix("기침약", "기침약 주세요", 120, false)).toBe("기침약");
  });
  it("brokers SDP without exposing the server key in its answer", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      expect((init?.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer server-secret",
      );
      expect(init?.body).toBeInstanceOf(FormData);
      return new Response("v=0\r\no=answer");
    };
    try {
      const answer = await createRealtimeTranscriptionCall({
        apiKey: "server-secret",
        sdp: "v=0\r\no=offer",
        safetyIdentifier: "hashed-tenant",
        signal: new AbortController().signal,
        endpoint: "https://example.invalid/calls",
      });
      expect(answer).toBe("v=0\r\no=answer");
      expect(answer).not.toContain("server-secret");
    } finally {
      globalThis.fetch = original;
    }
  });
});
