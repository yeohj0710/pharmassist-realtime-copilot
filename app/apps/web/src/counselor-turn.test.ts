// The counselor's words are written by the model, so these are the rules that
// decide whether they may be spoken. Every rejection here is a sentence the
// engine's own wording replaces, which is why the referee can afford to be
// strict: refusing costs quality, accepting something wrong costs safety.
import { describe, expect, it } from "vitest";
import type { RuntimeOutput } from "@pharmassist/contracts";
import {
  counselorAskSlot,
  counselorBoundary,
  deterministicCounselorTurn,
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
  ...overrides,
});

const turn = (say: string, ask: string | null = null) => ({ say, ask });

const reasons = (
  verdict: ReturnType<typeof refereeCounselorTurn>,
): readonly string[] => (verdict.status === "rejected" ? verdict.reasons : []);

describe("what the counselor may say", () => {
  it("accepts a warm line that names only a chosen product", () => {
    const verdict = refereeCounselorTurn(
      turn(
        "많이 불편하셨겠어요. 겔포스엠 한번 보시면 좋을 것 같아요.",
        "언제부터 그러셨어요?",
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

  it("refuses a medicine name the pack has never heard of", () => {
    // The pack-wide comparison cannot see this one: it is not a product from
    // another decision, it does not exist.
    for (const line of [
      "부스코판정을 한번 보셔도 좋아요.",
      "타이레놀정 어떠세요.",
      "이가탄에프캡슐을 권해드려요.",
      "아나프록스시럽이 맞으실 거예요.",
      "리엔프로연고를 발라보세요.",
    ])
      expect(reasons(refereeCounselorTurn(turn(line), boundary()))).toContain(
        "UNVERIFIED_PRODUCT_NAME",
      );
  });

  it("leaves ordinary counter speech alone", () => {
    // Every one of these ends in a syllable a dosage form also ends in. A
    // rejection here costs the customer a warm sentence for nothing, so the
    // rule is written to need a real stem in front of the form.
    for (const line of [
      "너무 걱정하지 마세요.",
      "정도가 심하면 알려주세요.",
      "우선 안정을 취하시는 게 좋아요.",
      "재조정이 필요할 수도 있어요.",
      "현탁액 형태라 드시기 편하실 거예요.",
      "연고를 발라보신 적 있으세요.",
      "위산이 올라오는 느낌이시군요.",
      "판정이 어려운 상태예요.",
    ])
      expect(
        reasons(refereeCounselorTurn(turn(line), boundary())),
      ).not.toContain("UNVERIFIED_PRODUCT_NAME");
  });

  it("speaks a long registered name by its head", () => {
    // 타세놀정500밀리그램(아세트아미노펜) is said as 타세놀정; the strength and
    // ingredient tail are for the record, not the counter.
    const verdict = refereeCounselorTurn(
      turn("타세놀정 한번 보시면 좋을 것 같아요."),
      boundary({
        allowedProducts: ["타세놀정500밀리그램(아세트아미노펜)"],
        knownProducts: ["타세놀정500밀리그램(아세트아미노펜)"],
      }),
    );

    expect(verdict.status).toBe("accepted");
  });

  it("lets the counselor name an ingredient the engine put forward", () => {
    const verdict = refereeCounselorTurn(
      turn("인산알루미늄겔이 들어간 쪽이 맞으실 것 같아요."),
      boundary({ allowedIngredients: ["인산알루미늄겔"] }),
    );

    expect(verdict.status).toBe("accepted");
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

  it("lets the counselor ask whatever it judges worth asking", () => {
    // Nothing in the pack offers this question. The counselor asks it anyway,
    // because deciding what to ask is its job now — the referee only guards
    // what may be said.
    const verdict = refereeCounselorTurn(
      turn("네 알겠습니다.", "혹시 지금 드시는 다른 약이 있으세요?"),
      boundary(),
    );

    expect(verdict.status).toBe("accepted");
    expect(verdict.status === "accepted" && verdict.turn.ask).toBe(
      "혹시 지금 드시는 다른 약이 있으세요?",
    );
  });

  it("refuses a question hidden inside the spoken line", () => {
    // Two questions in one breath, and the pharmacist sees only one of them
    // presented as a question.
    expect(
      reasons(
        refereeCounselorTurn(
          turn("배가 어떻게 불편하세요?", "언제부터요?"),
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
  it("allows only this turn's candidates", () => {
    const result = counselorBoundary(output(), ["겔포스엠", "포타겔현탁액"]);

    expect(result.allowedProducts).toEqual(["겔포스엠"]);
    expect(result.mustNotNameProduct).toBe(false);
    expect(result.referralRequired).toBe(false);
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
      turn("속쓰림에는 겔포스엠이 무난해요.", "언제부터요?"),
    );

    expect(applied.say_now).toEqual(["속쓰림에는 겔포스엠이 무난해요."]);
    expect(applied.ask_next[0]?.slot).toBe(counselorAskSlot);
    expect(applied.ask_next[0]?.question).toBe("언제부터요?");
    expect(applied.decision).toEqual(output().decision);
  });

  it("does not put the engine's question back when the counselor asked none", () => {
    // This restoration is what made the consultation restate itself: the
    // counselor moved on, the engine's own pending question reappeared, and
    // the customer was asked the same thing again.
    const applied = withCounselorTurn(
      output({
        decision: {
          status: "ask",
          product_candidates: [],
          ingredient_options: [],
        },
      }),
      turn("천천히 말씀해 주셔도 괜찮아요."),
    );

    expect(applied.ask_next).toEqual([]);
  });

  it("drops the question when the counselor asks nothing", () => {
    expect(
      withCounselorTurn(output(), turn("겔포스엠이 무난해요.")).ask_next,
    ).toEqual([]);
  });

  it("falls back to exactly what the engine would have said", () => {
    expect(deterministicCounselorTurn(output())).toEqual({
      say: "현재 정보로는 겔포스엠을 살펴볼게요.",
      ask: "배가 어떻게 불편한가요?",
    });
  });
});
