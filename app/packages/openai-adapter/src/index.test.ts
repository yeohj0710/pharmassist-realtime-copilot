import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { describe, expect, it } from "vitest";
import {
  createRealtimeTranscriptionCall,
  conversationInterpretationSchema,
  emptyTranscriptState,
  isDeferredPharmacyAnswer,
  isReportStyleNarration,
  joinNarration,
  limitCounterConversationOutput,
  MockResponsesRefiner,
  pharmacyNarrationMessages,
  PHARMACY_COUNTER_NARRATION_PROMPT,
  postValidateOutput,
  reduceRealtime,
  safeOpenAIConfig,
  stablePrefix,
  toStrictOutputSchema,
} from "./index.js";

it("allows non-catalog dialogue acts without forcing a clinical intent", () => {
  const schema = conversationInterpretationSchema([
    { intent: "headache", title: "두통 문의", aliases: ["머리가 아파요"] },
    {
      intent: "cough_general",
      title: "기침 일반 문의",
      aliases: ["기침이 나요", "콜록거려요"],
    },
  ]);
  expect(schema).toMatchObject({
    additionalProperties: false,
    required: ["disposition", "intent", "confidence", "topic_changed"],
    properties: {
      disposition: {
        enum: [
          "clinical_intent",
          "answer_or_detail",
          "conversation_only",
          "unclear",
        ],
      },
      intent: {
        anyOf: [{ enum: ["headache", "cough_general"] }, { type: "null" }],
      },
    },
  });
});

const base: RuntimeOutput = {
  request_id: "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349",
  session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  sequence: 2,
  mode: "clarify",
  status: "blocked",
  intent: null,
  say_now: ["선택에 필요한 증상 정보를 한 가지만 알려주세요?"],
  ask_next: [
    {
      question: "선택에 필요한 증상 정보를 한 가지만 알려주세요?",
      reason: "선택을 바꾸는 정보 확인",
      priority: 1,
      slot: "symptom",
    },
  ],
  red_flags: [],
  actions: [],
  avoid: [],
  missing_slots: ["product"],
  confidence: 1,
  decision: {
    decision_id: "DEC-C5BEED71ACDE4A338C5AA33FFDD81F6D-2",
    status: "ask",
    pack_id: "PACK-TEST",
    protocol_id: null,
    intent: null,
    tenant_inventory_connected: false,
    ingredient_options: [],
    product_candidates: [],
    question: {
      question: "선택에 필요한 증상 정보를 한 가지만 알려주세요?",
      reason: "선택을 바꾸는 정보 확인",
      slot: "symptom",
    },
    referral: null,
    source_refs: [],
    reason_codes: ["TEST_ASK"],
  },
  topic_results: [],
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

const sourceRef = {
  claim_id: "CLM-TEST",
  source_id: "SRC-TEST",
  source_snapshot_id: "SNP-TEST",
  locator: "test",
  verified_at: "2026-07-10T00:00:00Z",
} as const;

const recommendedDecision = (
  protocolId: string,
  productName: string,
  ingredientName: string,
): RuntimeOutput["decision"] => ({
  ...base.decision,
  decision_id: `${base.decision.decision_id}-${protocolId}`,
  status: "recommend",
  protocol_id: protocolId,
  intent: protocolId,
  ingredient_options: [
    {
      option_id: `OPT-${protocolId}`,
      ingredient_id: `ING-${protocolId}`,
      ingredient_name: ingredientName,
      claim_ids: [sourceRef.claim_id],
      source_refs: [sourceRef],
      clinical_score: 0.8,
      safety_score: 0.8,
    },
  ],
  product_candidates: [
    {
      product_id: `PRD-${protocolId}`,
      display_name: productName,
      ingredient_id: `ING-${protocolId}`,
      claim_ids: [sourceRef.claim_id],
      source_refs: [sourceRef],
      formulary_active: true,
      inventory_status: "not_connected",
      available_quantity: null,
      sales_rank: null,
    },
  ],
  question: null,
  referral: null,
  source_refs: [sourceRef],
  reason_codes: ["TEST_RECOMMEND"],
});

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
  it("uses a pharmacy-counter writing assistant role without impersonating a pharmacist", () => {
    expect(PHARMACY_COUNTER_NARRATION_PROMPT).toContain(
      "상담 문장을 작성하는 어시스턴트",
    );
    expect(PHARMACY_COUNTER_NARRATION_PROMPT).toContain(
      "면허 약사라고 자칭하거나",
    );
    expect(PHARMACY_COUNTER_NARRATION_PROMPT).not.toMatch(
      /당신은 .*면허 약사(?:다|입니다)/u,
    );
  });
  it("rejects report-style AI narration before it reaches the patient", () => {
    const reportStyle =
      "복통과 함께 배에 불편이 느껴지는 상황으로 보입니다. 현재 증상에 연결된 후보로 인산알루미늄겔을 고려해볼 수 있습니다.";
    expect(isReportStyleNarration(reportStyle)).toBe(true);
    expect(
      isReportStyleNarration(
        "배가 아프면서 속도 불편하셨군요. 지금은 겔포스엠현탁액을 후보로 볼게요.",
      ),
    ).toBe(false);
    expect(
      postValidateOutput(context, { ...base, say_now: [reportStyle] }),
    ).toEqual({ ok: false, code: "REPORT_STYLE_NARRATION" });
  });
  it("gives the narrator its role, safety policy, and prior conversation", () => {
    const messages = pharmacyNarrationMessages({
      ...context,
      redactedText: "속도 불편해요",
      promptSystem: "DECISION_LOCK",
      promptDeveloper: "SUPPLIED_FACTS_ONLY",
      promptDeveloperOverride: "NO_NEW_RECOMMENDATION",
      conversation: [
        { role: "user", content: "배가 아파요" },
        { role: "assistant", content: "어떻게 아픈가요?" },
        { role: "user", content: "속도 불편해요" },
      ],
    });
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "developer",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[0]?.content).toContain("상담 문장을 작성하는 어시스턴트");
    expect(messages[0]?.content).toContain("DECISION_LOCK");
    expect(messages[1]?.content).toContain("SUPPLIED_FACTS_ONLY");
    expect(messages[1]?.content).toContain("NO_NEW_RECOMMENDATION");
    expect(
      messages.filter(
        (message) =>
          message.role === "user" && message.content === "속도 불편해요",
      ),
    ).toHaveLength(1);
  });
  it("rejects efficacy rationale added during wording refinement", () => {
    expect(
      postValidateOutput(context, {
        ...base,
        say_now: [
          "똥마려운 듯한 배 아픔에는 속쓰림 관련 불편의 완화 후보로 쓰일 수 있어요.",
        ],
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED_CLAIM" });
  });
  it("detects promises that defer the actual pharmacy guidance", () => {
    expect(
      isDeferredPharmacyAnswer({
        say_now: [
          "속쓰림 완화에 적합한 즉시 효과 약은 일반의약품 중에서 제시할게요.",
        ],
      }),
    ).toBe(true);
    expect(
      isDeferredPharmacyAnswer({
        say_now: ["알긴산 제제를 비교하고 자극적인 음식은 피하세요."],
      }),
    ).toBe(false);
  });
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
  it("accepts only an exact decision-scoped sentence", () => {
    expect(
      postValidateOutput(context, {
        ...base,
        say_now: ["이 약을 500mg씩 복용하세요."],
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED_ENTITY" });
    expect(
      postValidateOutput(context, {
        ...base,
        say_now: ["증상 정보를 한 가지만 알려주세요."],
      }),
    ).toEqual({ ok: true });
  });
  it("rejects narration that dumps more than three sentences", () => {
    expect(
      postValidateOutput(context, {
        ...base,
        say_now: [
          "첫 설명입니다. 두 번째입니다. 세 번째입니다. 네 번째입니다.",
        ],
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED_ENTITY" });
  });
  it("rejects generic care-seeking language without a supplied referral", () => {
    expect(
      postValidateOutput(context, {
        ...base,
        say_now: ["증상이 지속되면 진료를 받으세요."],
      }),
    ).toEqual({ ok: false, code: "UNSUPPORTED_CLAIM" });
  });
  it("rejects AI narration that drops one of multiple symptom topics", () => {
    const throat = recommendedDecision(
      "PTC-SORE_THROAT",
      "타세놀정",
      "아세트아미노펜",
    );
    const heartburn = recommendedDecision(
      "PTC-HEARTBURN",
      "겔포스엠현탁액",
      "인산알루미늄",
    );
    const multi: RuntimeOutput = {
      ...base,
      mode: "instant",
      status: "provisional",
      decision: heartburn,
      topic_results: [
        {
          protocol_id: "PTC-HEARTBURN",
          intent: "heartburn",
          symptom_category: "소화기/속쓰림",
          decision: heartburn,
          ask_next: [],
        },
        {
          protocol_id: "PTC-SORE_THROAT",
          intent: "sore_throat",
          symptom_category: "감기/인후통",
          decision: throat,
          ask_next: [],
        },
      ],
      source_refs: [sourceRef],
      say_now: ["속쓰림과 인후통을 함께 확인하고 있어요."],
    };
    const multiContext = {
      ...context,
      instant: multi,
      allowedClaimIds: [sourceRef.claim_id],
      allowedEntities: [
        "타세놀정",
        "아세트아미노펜",
        "겔포스엠현탁액",
        "인산알루미늄",
      ],
    };

    expect(
      postValidateOutput(multiContext, {
        ...multi,
        say_now: ["속쓰림 후보는 겔포스엠현탁액입니다."],
      }),
    ).toEqual({ ok: false, code: "TOPIC_OMISSION" });
    expect(
      postValidateOutput(multiContext, {
        ...multi,
        say_now: [
          "속쓰림 후보는 겔포스엠현탁액이고 인후통 후보는 타세놀정입니다.",
        ],
      }),
    ).toEqual({ ok: true });
  });
  it("keeps a supplied follow-up question out of the candidate narration", () => {
    expect(
      joinNarration({
        reply:
          "지금은 타세놀정을 후보로 볼게요. 이 제품에는 아세트아미노펜 성분이 들어 있어요.",
        next_step: "목 통증은 언제부터 시작됐나요?",
      }),
    ).toBe(
      "지금은 타세놀정을 후보로 볼게요. 이 제품에는 아세트아미노펜 성분이 들어 있어요.",
    );
  });
  it("rejects definitive product direction while a question remains open", () => {
    const provisional: RuntimeOutput = {
      ...base,
      mode: "instant",
      status: "provisional",
      say_now: ["현재 제품 후보는 타세놀정입니다."],
      decision: {
        ...base.decision,
        status: "recommend",
        question: null,
      },
    };
    expect(
      postValidateOutput(
        { ...context, instant: provisional },
        { ...provisional, say_now: ["타세놀정으로 시작해 보세요."] },
      ),
    ).toEqual({ ok: false, code: "PROVISIONAL_NARRATION_REQUIRED" });
    expect(
      postValidateOutput(
        { ...context, instant: provisional },
        {
          ...provisional,
          say_now: [
            "현재 제품 후보는 타세놀정입니다. 선택에 필요한 증상 정보를 한 가지만 알려주세요?",
          ],
        },
      ),
    ).toEqual({ ok: false, code: "DUPLICATE_QUESTION" });
  });
  it("limits counter speech to one sentence and can suppress the one allowed question", () => {
    const limited = limitCounterConversationOutput({
      ...base,
      say_now: ["첫 문장입니다. 두 번째 설명입니다.", "세 번째입니다."],
    });
    expect(limited.say_now).toEqual(["첫 문장입니다."]);
    expect(limited.ask_next).toHaveLength(1);
    expect(limitCounterConversationOutput(limited, false).ask_next).toEqual([]);
  });
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
