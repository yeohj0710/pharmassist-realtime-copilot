import type { RuntimeInput } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { StatefulConsultFlow } from "./consult-flow.js";

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
    expect(second.output.actions[0]?.text).toContain("진해제");
  });

  it("still escalates when a later turn contains a red flag", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("기침이 나요", 1));
    const result = flow.run(input("지금 숨이 안 쉬어져요", 2));

    expect(result.output.mode).toBe("escalate");
    expect(result.output.red_flags).not.toHaveLength(0);
  });

  it("routes abdominal pain to the abdominal card instead of throat pain", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    const result = flow.run(input("배가 아파요", 1));

    expect(result.output.intent).toBe("abdominal_pain_general");
    expect(result.output.say_now.join(" ")).not.toContain("삼키기");
    expect(result.output.ask_next[0]?.question).toContain("배");
  });
});
