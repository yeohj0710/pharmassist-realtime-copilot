// The counselor's words are written by the model, so these are the rules that
// decide whether they may be spoken. Every rejection here is a sentence the
// engine's own wording replaces, which is why the referee can afford to be
// strict: refusing costs quality, accepting something wrong costs safety.
import { describe, expect, it } from "vitest";
import type { RuntimeOutput } from "@pharmassist/contracts";
import {
  counselorBoundary,
  deterministicCounselorTurn,
  openEndedSlot,
  refereeCounselorTurn,
  withCounselorTurn,
  type CounselorBoundary,
} from "./counselor-turn.js";

const boundary = (
  overrides: Partial<CounselorBoundary> = {},
): CounselorBoundary => ({
  allowedProducts: ["겔포스엠"],
  allowedIngredients: ["알마게이트"],
  knownProducts: ["겔포스엠", "포타겔현탁액", "이지엔6애니연질캡슐"],
  mustNotNameProduct: false,
  referralRequired: false,
  questionRequired: false,
  askableSlots: ["symptom.phenotype", openEndedSlot],
  ...overrides,
});

const turn = (
  say: string,
  ask: string | null = null,
  askSlot: string | null = null,
) => ({ say, ask, askSlot });

const reasons = (
  verdict: ReturnType<typeof refereeCounselorTurn>,
): readonly string[] => (verdict.status === "rejected" ? verdict.reasons : []);

describe("what the counselor may say", () => {
  it("accepts a warm line that names only a chosen product", () => {
    const verdict = refereeCounselorTurn(
      turn(
        "많이 불편하셨겠어요. 겔포스엠 한번 보시면 좋을 것 같아요.",
        "언제부터 그러셨어요?",
        "symptom.phenotype",
      ),
      boundary(),
    );

    expect(verdict.status).toBe("accepted");
  });

  it("refuses a product the engine did not choose", () => {
    // The name is real and in the pack — it simply belongs to another
    // decision, which is exactly the mistake worth catching.
    expect(
      reasons(
        refereeCounselorTurn(
          turn("포타겔현탁액이 잘 맞으실 거예요."),
          boundary(),
        ),
      ),
    ).toContain("OFF_LIST_PRODUCT");
  });

  it("refuses any product when a referral is in force", () => {
    expect(
      reasons(
        refereeCounselorTurn(
          turn("겔포스엠 드시면서 지켜보세요."),
          boundary({ mustNotNameProduct: true }),
        ),
      ),
    ).toContain("PRODUCT_NAMED_WITHOUT_CANDIDATE");
  });

  it("accepts a referral line that names nothing", () => {
    const verdict = refereeCounselorTurn(
      turn("이건 약으로 두고 보기보다 진료를 먼저 받아보시는 게 좋겠어요."),
      boundary({ mustNotNameProduct: true, allowedProducts: [] }),
    );

    expect(verdict.status).toBe("accepted");
  });

  it("refuses a stated dose in any shape", () => {
    for (const line of [
      "하루 3번 드세요.",
      "1회 2정씩 드시면 됩니다.",
      "500mg 정도가 적당해요.",
    ])
      expect(reasons(refereeCounselorTurn(turn(line), boundary()))).toContain(
        "DOSAGE_STATED",
      );
  });

  it("keeps a plain duration out of the dose rule", () => {
    // 3일째, 2주 정도 are the customer's own timeline, not an instruction.
    const verdict = refereeCounselorTurn(
      turn("3일째 그러셨다니 많이 힘드셨겠어요."),
      boundary(),
    );

    expect(verdict.status).toBe("accepted");
  });

  it("refuses engine vocabulary reaching the customer", () => {
    expect(
      reasons(
        refereeCounselorTurn(
          turn("현재 지식팩 데이터로는 후보를 정할 수 없습니다."),
          boundary(),
        ),
      ),
    ).toContain("INTERNAL_VOCABULARY");
  });

  it("refuses a question the engine cannot record", () => {
    expect(
      reasons(
        refereeCounselorTurn(
          turn("네 알겠습니다.", "혹시 혈압약 드세요?", "patient.medications"),
          boundary(),
        ),
      ),
    ).toContain("ILLEGAL_ASK_SLOT");
    expect(
      reasons(
        refereeCounselorTurn(
          turn("네 알겠습니다.", "혹시 혈압약 드세요?", null),
          boundary(),
        ),
      ),
    ).toContain("ASK_WITHOUT_SLOT");
  });

  it("refuses a question hidden inside the spoken line", () => {
    // Asked there it carries no slot, so the engine could never record it.
    expect(
      reasons(
        refereeCounselorTurn(
          turn("배가 어떻게 불편하세요?", "언제부터요?", "symptom.phenotype"),
          boundary(),
        ),
      ),
    ).toContain("QUESTION_INSIDE_SAY");
  });

  it("lets the counselor ask nothing at all", () => {
    const verdict = refereeCounselorTurn(
      turn("말씀하신 증상에는 겔포스엠이 무난해요."),
      boundary(),
    );

    expect(verdict.status).toBe("accepted");
    expect(verdict.status === "accepted" && verdict.turn.ask).toBeNull();
  });

  it("refuses an empty or runaway line", () => {
    expect(reasons(refereeCounselorTurn(turn("  "), boundary()))).toContain(
      "SAY_LENGTH",
    );
    expect(
      reasons(refereeCounselorTurn(turn("네".repeat(400)), boundary())),
    ).toContain("SAY_LENGTH");
  });
});

const output = (overrides: Record<string, unknown> = {}) =>
  ({
    mode: "instant",
    say_now: ["현재 정보로는 겔포스엠을 살펴볼게요."],
    ask_next: [
      {
        question: "배가 어떻게 불편한가요?",
        reason: "분기 확인",
        priority: 1,
        slot: "symptom.phenotype",
      },
    ],
    fact_targets: [
      {
        slot: "symptom.duration",
        question: "언제부터 그러셨나요?",
        options: [{ key: "RUL-X-SELECT-1", phrases: ["어제"] }],
      },
    ],
    decision: {
      status: "recommend",
      product_candidates: [{ display_name: "겔포스엠" }],
      ingredient_options: [{ ingredient_name: "알마게이트" }],
    },
    ...overrides,
  }) as unknown as RuntimeOutput;

describe("the boundary the engine publishes", () => {
  it("allows only this turn's candidates and this turn's questions", () => {
    const result = counselorBoundary(output(), ["겔포스엠", "포타겔현탁액"]);

    expect(result.allowedProducts).toEqual(["겔포스엠"]);
    expect(result.mustNotNameProduct).toBe(false);
    expect(result.referralRequired).toBe(false);
    expect(result.askableSlots).toEqual([
      "symptom.phenotype",
      "symptom.duration",
      openEndedSlot,
    ]);
  });

  it("forbids naming a product when the engine has none to offer", () => {
    const result = counselorBoundary(
      output({
        decision: {
          status: "ask",
          product_candidates: [],
          ingredient_options: [],
        },
      }),
      ["겔포스엠"],
    );

    expect(result.mustNotNameProduct).toBe(true);
    // Nothing to offer yet is not the same as needing a doctor: this customer
    // is mid-consultation and must not be sent away.
    expect(result.referralRequired).toBe(false);
  });

  it("forbids naming a product on an escalation", () => {
    const result = counselorBoundary(output({ mode: "escalate" }), [
      "겔포스엠",
    ]);

    expect(result.mustNotNameProduct).toBe(true);
    expect(result.referralRequired).toBe(true);
  });
});

describe("applying an accepted turn", () => {
  it("replaces the words and the question, keeping the decision intact", () => {
    const applied = withCounselorTurn(
      output(),
      turn(
        "속쓰림에는 겔포스엠이 무난해요.",
        "언제부터요?",
        "symptom.duration",
      ),
    );

    expect(applied.say_now).toEqual(["속쓰림에는 겔포스엠이 무난해요."]);
    expect(applied.ask_next[0]?.slot).toBe("symptom.duration");
    expect(applied.ask_next[0]?.question).toBe("언제부터요?");
    expect(applied.decision).toEqual(output().decision);
  });

  it("keeps the engine's question when the decision cannot proceed without it", () => {
    // The counselor may decide not to ask; it may not decide the engine has
    // enough to go on.
    const applied = withCounselorTurn(
      output({
        decision: {
          status: "ask",
          product_candidates: [],
          ingredient_options: [],
        },
      }),
      turn("어디가 불편하신지 조금만 더 말씀해 주시겠어요?"),
    );

    expect(applied.ask_next[0]?.slot).toBe("symptom.phenotype");
  });

  it("drops the question when the engine no longer needs one", () => {
    expect(
      withCounselorTurn(output(), turn("겔포스엠이 무난해요.")).ask_next,
    ).toEqual([]);
  });

  it("falls back to exactly what the engine would have said", () => {
    expect(deterministicCounselorTurn(output())).toEqual({
      say: "현재 정보로는 겔포스엠을 살펴볼게요.",
      ask: "배가 어떻게 불편한가요?",
      askSlot: "symptom.phenotype",
    });
  });
});
