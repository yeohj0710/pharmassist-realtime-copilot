import type { RuntimeInput } from "@pharmassist/contracts";
import {
  LocalClinicalEngine,
  type EngineResult,
  type RuntimePack,
} from "@pharmassist/runtime";

const candidateText: Readonly<Record<string, string>> = {
  cough_general:
    "기침 양상에 따라 맞는 약이 달라질 수 있어요. 마른기침에는 진해제 계열, 가래가 있으면 거담제 계열을 살펴볼 수 있어요.",
  nasal_symptom_general:
    "콧물이나 재채기에는 항히스타민제 계열, 코막힘에는 비충혈제거제 계열이 도움이 될 수 있어요.",
  sore_throat:
    "목 통증에는 통증 완화제나 트로키·스프레이 같은 목 국소 제형을 살펴볼 수 있어요.",
  dyspepsia_general:
    "속이 쓰리면 제산제 계열, 더부룩하고 소화가 안 되면 소화효소제 계열을 살펴볼 수 있어요.",
  abdominal_pain_general:
    "윗배가 쓰린 느낌이면 제산제 계열, 배가 쥐어짜듯 아프면 진경제 계열을 살펴볼 수 있어요.",
  bowel_urgency_general:
    "묽은 변이 반복되면 수분·전해질 보충이 우선이에요. 변이 잘 나오지 않는 불편이라면 변비 완화제 계열을 살펴볼 수 있어요.",
  musculoskeletal_pain:
    "가벼운 근육이나 관절 통증에는 먹는 진통소염제나 바르는 소염진통제 계열을 살펴볼 수 있어요.",
  skin_general:
    "가려움에는 항히스타민제 계열, 건조해서 자극된 피부에는 보습·보호제를 살펴볼 수 있어요.",
  fever_general:
    "열이나 몸살에는 해열진통제 계열을 살펴볼 수 있어요. 현재 체온과 복용 중인 약이 있다면 함께 알려주세요.",
};

interface ConsultMemory {
  readonly turns: readonly string[];
  readonly activeIntent: string | null;
  readonly completed: boolean;
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
    const memory = this.sessions.get(input.session_id);
    const standalone = this.engine.run(input);
    const startsDifferentTopic = Boolean(
      memory?.completed &&
      standalone.output.intent &&
      standalone.output.intent !== memory.activeIntent,
    );
    const prior = startsDifferentTopic ? [] : (memory?.turns ?? []);
    const turns = [...prior, input.text].slice(-4);
    const combined = turns.join(" ").slice(-2_000);
    const result = startsDifferentTopic
      ? standalone
      : this.engine.run({ ...input, text: combined });
    const remember = (next: EngineResult): EngineResult => {
      const completed =
        next.output.ask_next.length === 0 &&
        (next.output.actions.length > 0 || next.output.status === "final");
      this.sessions.set(input.session_id, {
        turns,
        activeIntent: next.output.intent ?? memory?.activeIntent ?? null,
        completed,
      });
      return next;
    };
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
      return remember({
        ...result,
        output: {
          ...result.output,
          mode: "no_match",
          status: "final",
          say_now: [
            "말씀해 주신 내용만으로는 알맞은 안내를 드리기 어려워요. 가장 불편한 부위와 느낌을 한 문장으로 다시 말씀해 주세요.",
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
      });
    if (
      !candidate ||
      !routineClarification ||
      result.output.red_flags.length > 0 ||
      (turns.length < 2 && !durationIncluded)
    )
      return remember(result);

    return remember({
      ...result,
      output: {
        ...result.output,
        mode: "instant",
        status: "stable",
        say_now: [candidate],
        ask_next: [],
        actions: [
          {
            type: "compare_candidate_class",
            text: "확인된 증상 양상에 맞는 일반약 성분군 후보를 검토한다.",
            requires_confirmation: false,
          },
        ],
        avoid: [
          "복용 중인 약이 있거나 임신·알레르기가 있다면 꼭 말씀해 주세요.",
        ],
        missing_slots: [],
      },
      ruleIds: result.ruleIds.filter((rule) => rule !== "ASK_ONE"),
    });
  }
}
