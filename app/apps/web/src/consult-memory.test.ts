import { describe, expect, it } from "vitest";
import {
  buildPatientSummary,
  isPatientFacingText,
  patientVisibleLines,
  upsertAssistantTurn,
} from "./consult-memory.js";

describe("consultation memory", () => {
  it("keeps accumulated patient facts beyond six turns", () => {
    const turns = [
      "환자: 배가 아파요",
      "상담 도우미: 언제부터 아팠나요?",
      "환자: 어제부터요",
      "상담 도우미: 어느 부위인가요?",
      "환자: 윗배요",
      "상담 도우미: 어떤 느낌인가요?",
      "환자: 쓰려요",
      "상담 도우미: 다른 증상도 있나요?",
      "환자: 잘 모르겠어요",
    ];
    const summary = buildPatientSummary(turns);

    expect(summary.facts).toContain("배가 아파요");
    expect(summary.duration).toBe("어제부터요");
    expect(summary.facts).toContain("윗배요");
    expect(summary.facts).toContain("쓰려요");
    expect(summary.facts).not.toContain("잘 모르겠어요");
  });

  it("replaces the provisional assistant turn with the refined answer", () => {
    const initial = ["환자: 기침이 나요"];
    const local = upsertAssistantTurn(initial, 1, "언제부터 시작됐나요?");
    const refined = upsertAssistantTurn(
      local,
      1,
      "기침은 언제부터 시작됐나요?",
    );

    expect(refined).toEqual([
      "환자: 기침이 나요",
      "상담 도우미: 기침은 언제부터 시작됐나요?",
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
      "기침 양상을 조금 더 여쭤볼게요.",
      "가래도 함께 나오나요?",
    ]);
    expect(isPatientFacingText("성분군 후보를 검토한다.")).toBe(false);
  });
});
