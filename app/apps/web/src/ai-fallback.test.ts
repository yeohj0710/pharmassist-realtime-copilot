import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { customerTurn } from "@pharmassist/dialogue";
import {
  answeredOptionFromInterpretation,
  answeredSlotFromInterpretation,
  buildAiRefinementBody,
  failureLeavesAiAvailable,
  interpretedIntent,
  pendingCounselorQuestion,
  requestAiInterpretation,
  shouldBypassAiInterpretation,
  shouldInterpretWithAi,
  shouldRequestAiRefinement,
  type AiConversationInterpretation,
} from "./ai-fallback.js";

const openQuestion = {
  question: "언제부터 그러셨나요?",
  slot: "symptom.duration",
  options: [],
};
const interpretation = (
  overrides: Partial<AiConversationInterpretation> = {},
): AiConversationInterpretation => ({
  disposition: "answer_or_detail",
  intent: null,
  confidence: 0.9,
  topicChanged: false,
  answersPendingQuestion: true,
  answerOptionKey: null,
  ...overrides,
});

describe("AI refinement routing", () => {
  it("uses AI on a normal turn even when the local engine already chose an intent", () => {
    expect(shouldRequestAiRefinement(true, "instant", "recommend")).toBe(true);
  });

  it("keeps emergency escalation local and immediate", () => {
    expect(shouldRequestAiRefinement(true, "escalate", "refer")).toBe(false);
  });

  it("keeps questions local instead of sending them through product narration", () => {
    expect(shouldRequestAiRefinement(true, "clarify", "ask")).toBe(false);
  });

  it("bypasses the network for explicit red flags", () => {
    expect(shouldBypassAiInterpretation("숨쉬기 너무 힘들어요")).toBe(true);
    expect(shouldBypassAiInterpretation("가슴이 짓눌리고 식은땀이 나요")).toBe(
      true,
    );
    expect(shouldBypassAiInterpretation("기침 때문에 밤에 좀 깼어요")).toBe(
      false,
    );
  });

  it("interprets contextual answers and possible topic changes while a question is open", () => {
    expect(shouldInterpretWithAi(true, true, "따갑고 아픈 정도예요")).toBe(
      true,
    );
    expect(shouldInterpretWithAi(true, true, "처음 하는 새로운 문의")).toBe(
      true,
    );
  });

  it("sends recent turns so AI can recognize an answered duration question", () => {
    const body = buildAiRefinementBody(
      {} as RuntimeInput,
      { knowledge_version: "v" } as RuntimeOutput,
      [customerTurn("기침이 나요", 1), customerTurn("어제부터요", 2)],
    );
    expect(body.conversation_history).toEqual([
      "손님: 기침이 나요",
      "손님: 어제부터요",
    ]);
  });
});

describe("answers to an open counselor question", () => {
  it("takes the open question from the previous turn", () => {
    expect(
      pendingCounselorQuestion({
        ask_next: [{ ...openQuestion, reason: "증상 기간 확인", priority: 1 }],
      } as unknown as RuntimeOutput),
    ).toEqual(openQuestion);
    expect(
      pendingCounselorQuestion({ ask_next: [] } as unknown as RuntimeOutput),
    ).toBeUndefined();
    expect(pendingCounselorQuestion(undefined)).toBeUndefined();
  });

  it("fills the slot the counselor asked about, never one the model picks", () => {
    expect(answeredSlotFromInterpretation(interpretation(), openQuestion)).toBe(
      "symptom.duration",
    );
  });

  it("ignores a claimed answer when nothing was asked", () => {
    expect(
      answeredSlotFromInterpretation(interpretation(), undefined),
    ).toBeUndefined();
  });

  it("leaves the question open on a topic change or a low-confidence read", () => {
    expect(
      answeredSlotFromInterpretation(
        interpretation({ topicChanged: true }),
        openQuestion,
      ),
    ).toBeUndefined();
    expect(
      answeredSlotFromInterpretation(
        interpretation({ confidence: 0.3 }),
        openQuestion,
      ),
    ).toBeUndefined();
    expect(
      answeredSlotFromInterpretation(
        interpretation({ answersPendingQuestion: false }),
        openQuestion,
      ),
    ).toBeUndefined();
  });

  it("keeps a new clinical intent separate from the answered slot", () => {
    expect(
      interpretedIntent(
        interpretation({
          disposition: "clinical_intent",
          intent: "cough_general",
        }),
      ),
    ).toBe("cough_general");
    expect(interpretedIntent(interpretation())).toBeUndefined();
  });

  it("passes the chosen branch only under the answered-slot gate", () => {
    const menu = {
      question: "배가 어떻게 불편한가요?",
      slot: "symptom.phenotype",
      options: [{ key: "RUL-X-SELECT-1", phrases: ["속쓰림"] }],
    };
    expect(
      answeredOptionFromInterpretation(
        interpretation({ answerOptionKey: "RUL-X-SELECT-1" }),
        menu,
      ),
    ).toBe("RUL-X-SELECT-1");
    // No key, a topic change, or no open question → no branch.
    expect(
      answeredOptionFromInterpretation(interpretation(), menu),
    ).toBeUndefined();
    expect(
      answeredOptionFromInterpretation(
        interpretation({
          answerOptionKey: "RUL-X-SELECT-1",
          topicChanged: true,
        }),
        menu,
      ),
    ).toBeUndefined();
    expect(
      answeredOptionFromInterpretation(
        interpretation({ answerOptionKey: "RUL-X-SELECT-1" }),
        undefined,
      ),
    ).toBeUndefined();
  });
});

describe("what a failed interpretation says about AI availability", () => {
  it("blames the turn, not the service, for input and schema failures", () => {
    // These recur only for this wording, so the badge must keep saying 연결됨.
    expect(failureLeavesAiAvailable("INVALID_INPUT")).toBe(true);
    expect(failureLeavesAiAvailable("PRIVACY_REDACTION_FAILED")).toBe(true);
    expect(failureLeavesAiAvailable("MODEL_SCHEMA_INVALID")).toBe(true);
  });

  it("treats a safe failure as the service being unable to answer", () => {
    // An exhausted quota surfaces here: the readiness probe still sees a key,
    // so this is the only signal that stops the badge claiming a connection.
    expect(failureLeavesAiAvailable("INTERNAL_SAFE_FAILURE")).toBe(false);
  });

  it("counts an unrecognized or missing error code against availability", () => {
    // KNOWLEDGE_STALE and MODEL_TIMEOUT come from the Fastify API path.
    expect(failureLeavesAiAvailable("KNOWLEDGE_STALE")).toBe(false);
    expect(failureLeavesAiAvailable("MODEL_TIMEOUT")).toBe(false);
    expect(failureLeavesAiAvailable("FORBIDDEN")).toBe(false);
    expect(failureLeavesAiAvailable(undefined)).toBe(false);
    expect(failureLeavesAiAvailable(null)).toBe(false);
    expect(failureLeavesAiAvailable(503)).toBe(false);
  });

  it("matches the code exactly rather than by substring", () => {
    expect(failureLeavesAiAvailable("INVALID_INPUT_LENGTH")).toBe(false);
    expect(failureLeavesAiAvailable("invalid_input")).toBe(false);
  });
});

describe("the outcome a real interpretation request reports", () => {
  // The request builder reads the access passcode from session storage, which
  // the node test environment does not provide.
  const stubSessionStorage = (): void => {
    vi.stubGlobal("sessionStorage", { getItem: () => "0903" });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respondWith = (status: number, body: unknown): void => {
    stubSessionStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        }),
      ),
    );
  };

  const interpret = () =>
    requestAiInterpretation(
      "아침쯤이라고요",
      [],
      null,
      openQuestion,
      new AbortController().signal,
    );

  it("reports a usable interpretation", async () => {
    respondWith(200, {
      disposition: "answer_or_detail",
      intent: null,
      confidence: 0.9,
      topic_changed: false,
      answers_pending_question: true,
    });
    await expect(interpret()).resolves.toEqual({
      status: "interpreted",
      interpretation: interpretation(),
    });
  });

  it("reports a safe failure as the service being unavailable", async () => {
    // The quota-exhausted shape: this is what has to reach the badge.
    respondWith(503, {
      error: {
        code: "INTERNAL_SAFE_FAILURE",
        message: "AI 해석 응답을 받지 못했습니다.",
      },
    });
    await expect(interpret()).resolves.toEqual({ status: "unavailable" });
  });

  it("keeps the service available when only this turn was rejected", async () => {
    respondWith(422, {
      error: {
        code: "PRIVACY_REDACTION_FAILED",
        message: "개인정보를 제외해 주세요.",
      },
    });
    await expect(interpret()).resolves.toEqual({ status: "rejected" });
  });

  it("treats a failure with an unreadable body as unavailable", async () => {
    stubSessionStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error("not json")),
        }),
      ),
    );
    await expect(interpret()).resolves.toEqual({ status: "unavailable" });
  });

  it("rejects an answered-but-malformed payload without blaming availability", async () => {
    respondWith(200, {
      disposition: "nonsense",
      intent: null,
      confidence: 0.9,
    });
    await expect(interpret()).resolves.toEqual({ status: "rejected" });
  });

  it("keeps only an answer option key this question actually offered", async () => {
    const menuQuestion = {
      question: "배가 어떻게 불편한가요?",
      slot: "symptom.phenotype",
      options: [{ key: "RUL-X-SELECT-1", phrases: ["속쓰림"] }],
    };
    const reply = (key: string) => ({
      disposition: "answer_or_detail",
      intent: null,
      confidence: 0.9,
      topic_changed: false,
      answers_pending_question: true,
      answer_option_key: key,
    });
    respondWith(200, reply("RUL-X-SELECT-1"));
    const offered = await requestAiInterpretation(
      "속이 쓰린 것 같아요",
      [],
      null,
      menuQuestion,
      new AbortController().signal,
    );
    expect(
      offered.status === "interpreted" &&
        offered.interpretation.answerOptionKey,
    ).toBe("RUL-X-SELECT-1");

    respondWith(200, reply("RUL-SOMETHING-ELSE"));
    const foreign = await requestAiInterpretation(
      "속이 쓰린 것 같아요",
      [],
      null,
      menuQuestion,
      new AbortController().signal,
    );
    expect(
      foreign.status === "interpreted" &&
        foreign.interpretation.answerOptionKey,
    ).toBeNull();
  });
});
