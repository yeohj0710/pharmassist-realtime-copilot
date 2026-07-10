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
  abdominal_pain_general:
    "쓰린 윗배 통증은 제산제 계열, 쥐어짜는 복부 불편은 진경제 계열을 먼저 비교하세요.",
  bowel_urgency_general:
    "묽은 변이 반복되면 수분·전해질 보충제와 장 흡착제 계열, 변이 안 나오면 변비 완화제 계열을 먼저 비교하세요.",
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
      !result.output.intent &&
      result.output.red_flags.length === 0 &&
      turns.length >= 2
    )
      return {
        ...result,
        output: {
          ...result.output,
          mode: "no_match",
          status: "final",
          say_now: [
            "두 번 확인했지만 현재 지식팩에서 맞는 상담 카드를 찾지 못했습니다.",
          ],
          ask_next: [],
          actions: [
            {
              type: "restart_with_symptom",
              text: "새 상담을 눌러 증상 부위와 느낌을 한 문장으로 입력하세요.",
              requires_confirmation: false,
            },
          ],
          avoid: ["같은 질문을 반복하지 않습니다."],
          missing_slots: [],
          confidence: 0,
        },
      };
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
