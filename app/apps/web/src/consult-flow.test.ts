import type { RuntimeInput } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { StatefulConsultFlow } from "./consult-flow.js";
import { patientVisibleLines } from "./consult-memory.js";

const input = (text: string, sequence: number): RuntimeInput => ({
  request_id: crypto.randomUUID(),
  session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  sequence,
  input_type: "typed",
  text,
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: "2026-07-10T00:00:00Z",
});

describe("stateful fast consult flow", () => {
  it("keeps the original symptom and ends routine questioning on turn two", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    const first = flow.run(input("기침이 나요", 1));
    const second = flow.run(input("아침이요", 2));

    expect(first.output.ask_next).toHaveLength(1);
    expect(second.output.intent).toBe("cough_general");
    expect(second.output.mode).toBe("instant");
    expect(second.output.ask_next).toEqual([]);
    expect(second.output.say_now[0]).toContain("진해제");
    expect(second.output.say_now[0]).not.toContain("비교하세요");
    expect(second.output.say_now[0]).toMatch(/요\.$/u);
    expect(second.output.actions[0]?.text).toContain("검토한다");
  });

  it("still escalates when a later turn contains a red flag", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("기침이 나요", 1));
    const result = flow.run(input("지금 숨이 안 쉬어져요", 2));

    expect(result.output.mode).toBe("escalate");
    expect(result.output.red_flags).not.toHaveLength(0);
  });

  it.each(["잘 모르겠어요", "기억이 안 나요", "애매한데요", "글쎄요"])(
    "handles uncertain free-form answers without completing: %s",
    (answer) => {
      const flow = new StatefulConsultFlow(syntheticPack);
      flow.run(input("배가 아파요", 1));
      const result = flow.run(input(answer, 2));

      expect(result.output.mode).toBe("clarify");
      expect(result.output.actions).toEqual([]);
      expect(result.output.say_now.join(" ")).toContain("모르셔도");
      expect(result.output.ask_next[0]?.question).toContain("윗배·아랫배");
    },
  );

  it("does not treat an unrelated answer as a completed slot", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("기침이 나요", 1));
    const result = flow.run(input("그런데 약이 졸린가요?", 2));

    expect(result.output.mode).toBe("clarify");
    expect(result.output.actions).toEqual([]);
    expect(result.output.ask_next).not.toEqual([]);
  });

  it("switches to a clear new symptom before the previous topic completes", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("배가 아파요", 1));
    const result = flow.run(input("아, 그리고 어깨도 아파요", 2));

    expect(result.output.intent).toBe("musculoskeletal_pain");
    expect(result.output.ask_next[0]?.question).toContain("어깨");
  });

  it("routes abdominal pain to the abdominal card instead of throat pain", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    const result = flow.run(input("배가 아파요", 1));

    expect(result.output.intent).toBe("abdominal_pain_general");
    expect(result.output.say_now.join(" ")).not.toContain("삼키기");
    expect(result.output.ask_next[0]?.question).toContain("배");
  });

  it("routes bowel urgency and progresses after one short answer", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    const first = flow.run(input("똥이 마려워요", 1));
    const second = flow.run(input("3분 전부터요", 2));

    expect(first.output.intent).toBe("bowel_urgency_general");
    expect(first.output.ask_next[0]?.question).toContain("묽은 변");
    expect(second.output.mode).toBe("instant");
    expect(second.output.ask_next).toEqual([]);
    expect(second.output.say_now[0]).toContain("수분");
  });

  it("ends unsupported loops instead of repeating the generic question", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("알 수 없는 표현", 1));
    const second = flow.run(input("두 번째 설명", 2));

    expect(second.output.status).toBe("final");
    expect(second.output.ask_next).toEqual([]);
    expect(second.output.say_now.join(" ")).toContain("다시 말씀해 주세요");
  });

  it("routes shoulder pain to musculoskeletal instead of abdominal pain", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    const result = flow.run(input("어깨가 아파요", 1));

    expect(result.output.intent).toBe("musculoskeletal_pain");
    expect(result.output.ask_next[0]?.question).toContain("어깨");
    expect(result.output.say_now.join(" ")).not.toContain("배의");
  });

  it.each([
    ["기침이 나요", "어제부터요"],
    ["콧물이 나요", "어제부터요"],
    ["목이 아파요", "어제부터요"],
    ["소화가 안 돼요", "윗배가 더부룩해요"],
    ["배가 아파요", "윗배가 쓰려요"],
    ["설사할 것 같아요", "묽은 변이 나와요"],
    ["어깨가 아파요", "움직일 때 아파요"],
    ["피부가 가려워요", "팔이 어제부터 가려워요"],
    ["열이 나요", "30살이고 38도예요"],
  ])("keeps every supported route patient-facing: %s", (symptom, answer) => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input(symptom, 1));
    const result = flow.run(input(answer, 2));
    const visible = patientVisibleLines(result.output);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.join(" ")).not.toMatch(
      /비교하세요|확인한다|평가한다|검토한다|출력하지|판매를? 중단/u,
    );
  });
});
