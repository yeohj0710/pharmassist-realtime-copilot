import { describe, expect, it } from "vitest";
import {
  buildCustomerSummary,
  customerTurn,
  upsertCounselorTurn,
  type DialogueTurn,
} from "@pharmassist/dialogue";
import { isPatientFacingText, patientVisibleLines } from "./consult-memory.js";

describe("consultation memory", () => {
  it("keeps accumulated patient facts beyond six turns", () => {
    const turns: DialogueTurn[] = [
      customerTurn("배가 아파요", 1),
      { speaker: "counselor", text: "언제부터 아팠나요?", sequence: 1 },
      customerTurn("어제부터요", 2),
      { speaker: "counselor", text: "어느 부위인가요?", sequence: 2 },
      customerTurn("윗배요", 3),
      { speaker: "counselor", text: "어떤 느낌인가요?", sequence: 3 },
      customerTurn("쓰려요", 4),
      { speaker: "counselor", text: "다른 증상도 있나요?", sequence: 4 },
      customerTurn("잘 모르겠어요", 5),
    ];
    const summary = buildCustomerSummary(turns);

    expect(summary.facts).toContain("배가 아파요");
    expect(summary.duration).toBe("어제부터요");
    expect(summary.facts).toContain("윗배요");
    expect(summary.facts).toContain("쓰려요");
    expect(summary.facts).not.toContain("잘 모르겠어요");
  });

  it("replaces the provisional assistant turn with the refined answer", () => {
    const initial = [customerTurn("기침이 나요", 1)];
    const local = upsertCounselorTurn(initial, 1, "언제부터 시작됐나요?");
    const refined = upsertCounselorTurn(
      local,
      1,
      "기침은 언제부터 시작됐나요?",
    );

    expect(refined).toEqual([
      customerTurn("기침이 나요", 1),
      {
        speaker: "counselor",
        text: "기침은 언제부터 시작됐나요?",
        sequence: 1,
      },
    ]);
  });

  it("never exposes pharmacist-only actions as patient speech", () => {
    const visible = patientVisibleLines({
      say_now: ["기침 양상을 조금 더 여쭤볼게요."],
      ask_next: [{ question: "가래도 함께 나오나요?" }],
      actions: [
        {
          text: "진해제와 거담제 성분군 후보를 검토한다.",
        },
      ],
    });

    expect(visible).toEqual([
      "가래도 함께 나오나요?",
      "기침 양상을 조금 더 여쭤볼게요.",
    ]);
    expect(isPatientFacingText("성분군 후보를 검토한다.")).toBe(false);
  });

  it("does not list elliptical choices as standalone patient facts", () => {
    const summary = buildCustomerSummary([
      customerTurn("배가 아파요", 1),
      { speaker: "counselor", text: "설사인가요, 변비인가요?", sequence: 1 },
      customerTurn("아니 전자라고요", 2),
    ]);
    expect(summary.facts).toEqual(["배가 아파요"]);
  });

  it("does not store greetings as patient facts", () => {
    const summary = buildCustomerSummary([
      customerTurn("어이", 1),
      { speaker: "counselor", text: "네, 말씀하세요.", sequence: 1 },
    ]);
    expect(summary.facts).toEqual([]);
  });
});
