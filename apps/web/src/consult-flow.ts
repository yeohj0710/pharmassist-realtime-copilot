import type { RuntimeInput } from "@pharmassist/contracts";
import {
  LocalClinicalEngine,
  type EngineResult,
  type RuntimePack,
} from "@pharmassist/runtime";

const candidateText: Readonly<Record<string, string>> = {
  cough_general:
    "마른기침이면 진해제, 가래가 있으면 거담제 성분군을 먼저 비교하세요.",
  nasal_symptom_general:
    "콧물·재채기는 항히스타민제, 코막힘은 비충혈제거제 성분군을 먼저 비교하세요.",
  sore_throat:
    "통증 완화제와 목 국소 제형(트로키·스프레이) 성분군을 먼저 비교하세요.",
  dyspepsia_general:
    "속쓰림은 제산제, 더부룩함은 소화효소제 성분군을 먼저 비교하세요.",
  skin_general:
    "가려움은 항히스타민제, 건조 자극은 보습·보호제 성분군을 먼저 비교하세요.",
};

interface ConsultMemory {
  readonly turns: readonly string[];
}

export class StatefulConsultFlow {
  private readonly engine: LocalClinicalEngine;
  private readonly sessions = new Map<string, ConsultMemory>();

  constructor(pack: RuntimePack) {
    this.engine = new LocalClinicalEngine(pack, "local-demo");
  }

  reset(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  run(input: RuntimeInput): EngineResult {
    const prior = this.sessions.get(input.session_id)?.turns ?? [];
    const turns = [...prior, input.text].slice(-4);
    this.sessions.set(input.session_id, { turns });
    const combined = turns.join(" ").slice(-2_000);
    const result = this.engine.run({ ...input, text: combined });
    const candidate = result.output.intent
      ? candidateText[result.output.intent]
      : undefined;
    const routineClarification =
      result.ruleIds.includes("ASK_ONE") &&
      result.ruleIds.every((rule) => rule === "ASK_ONE");
    const durationIncluded =
      /(?:\d+|한|두|세|네)\s*(?:시간|일|주|개월)(?:째|간)?/u.test(combined);
    if (
      !candidate ||
      !routineClarification ||
      result.output.red_flags.length > 0 ||
      (turns.length < 2 && !durationIncluded)
    )
      return result;

    return {
      ...result,
      output: {
        ...result.output,
        mode: "instant",
        status: "stable",
        say_now: ["확인됐어요. 바로 비교할 약 후보입니다."],
        ask_next: [],
        actions: [
          {
            type: "compare_candidate_class",
            text: candidate,
            requires_confirmation: false,
          },
        ],
        avoid: ["복용약·임신·알레르기가 있으면 선택 전에 다시 확인하세요."],
        missing_slots: [],
      },
      ruleIds: result.ruleIds.filter((rule) => rule !== "ASK_ONE"),
    };
  }
}
