import { describe, expect, it } from "vitest";
import {
  buildCustomerSummary,
  customerTurn,
  parseDialogueTurns,
  renderQuestionTemplate,
  serializeDialogueTurns,
  toModelConversation,
  upsertCounselorTurn,
} from "./index.js";

describe("consultation dialogue", () => {
  it("keeps customer and counselor roles structured across the transport seam", () => {
    const turns = [
      customerTurn("무릎이 아파요", 1),
      ...upsertCounselorTurn([], 1, "언제부터 아프셨어요?"),
    ];
    const serialized = serializeDialogueTurns(turns);
    expect(serialized).toEqual([
      "손님: 무릎이 아파요",
      "상담자: 언제부터 아프셨어요?",
    ]);
    expect(toModelConversation(parseDialogueTurns(serialized))).toEqual([
      { role: "user", content: "무릎이 아파요" },
      { role: "assistant", content: "언제부터 아프셨어요?" },
    ]);
  });

  it("replaces only the counselor wording for the matching sequence", () => {
    const first = upsertCounselorTurn(
      [customerTurn("배가 아파요", 1)],
      1,
      "처음 질문",
    );
    const refined = upsertCounselorTurn(first, 1, "다듬은 질문");
    expect(refined).toEqual([
      customerTurn("배가 아파요", 1),
      { speaker: "counselor", text: "다듬은 질문", sequence: 1 },
    ]);
  });

  it("builds the summary from customer speech only", () => {
    const turns = upsertCounselorTurn(
      [customerTurn("무릎이 아파요", 1)],
      1,
      "어깨는 움직일 때 더 아픈가요?",
    );
    const summary = buildCustomerSummary(turns);
    expect(summary.facts).toEqual(["무릎이 아파요"]);
    expect(summary.facts.join(" ")).not.toContain("어깨");
  });

  it.each([
    ["무릎", "무릎은 움직일 때 더 아픈가요?"],
    ["어깨", "어깨는 움직일 때 더 아픈가요?"],
  ])(
    "renders the actual body site with a Korean particle",
    (bodySite, expected) => {
      expect(
        renderQuestionTemplate(
          "{{body_site|아픈 부위|topic}} 움직일 때 더 아픈가요?",
          {
            slots: { body_site: { value: bodySite } },
          },
        ),
      ).toBe(expected);
    },
  );

  it("uses the explicit fallback when the slot is missing", () => {
    expect(
      renderQuestionTemplate(
        "{{body_site|아픈 부위|topic}} 움직일 때 더 아픈가요?",
        {
          slots: {},
        },
      ),
    ).toBe("아픈 부위는 움직일 때 더 아픈가요?");
  });
});
