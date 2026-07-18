import type { RuntimeInput } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import { StatefulConsultFlow } from "./consult-flow.js";

const input = (text: string, sequence: number): RuntimeInput => ({
  request_id: crypto.randomUUID(),
  session_id: "487aaf2d-d9cc-4a19-a1ef-3fc0ddd34b71",
  sequence,
  input_type: "typed",
  text,
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: "2026-07-10T00:00:00Z",
});

describe("topic transitions", () => {
  it("starts a different symptom topic after the previous topic completed", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("배가 아파요", 1));
    const completed = flow.run(input("어제부터요", 2));
    const next = flow.run(input("그리고 어깨도 아파요", 3));

    expect(completed.output.actions).not.toHaveLength(0);
    expect(next.output.intent).toBe("musculoskeletal_pain");
    expect(next.output.actions).toEqual([]);
    expect(next.output.decision.status).toBe("ask");
    expect(next.output.decision.protocol_id).toBe("PTC-SYN-MUSCLE");
  });

  it("re-evaluates an AI-corrected turn from the state before that turn", () => {
    const flow = new StatefulConsultFlow(syntheticPack);
    flow.run(input("기침이 나요", 1));
    const immediate = flow.run(input("그리고 어깨도 아파요", 2));
    const corrected = flow.run(input("그리고 어깨 근육통도 있어요", 2));

    expect(
      new Set(immediate.output.topic_results.map((topic) => topic.protocol_id)),
    ).toEqual(new Set(["PTC-SYN-COUGH", "PTC-SYN-MUSCLE"]));
    expect(
      new Set(corrected.output.topic_results.map((topic) => topic.protocol_id)),
    ).toEqual(new Set(["PTC-SYN-COUGH", "PTC-SYN-MUSCLE"]));
    expect(corrected.consultationState.sequence).toBe(2);
  });
});
