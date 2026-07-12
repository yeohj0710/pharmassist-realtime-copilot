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

const uncertainPattern =
  /모르|몰라|애매|기억 안|기억이 안|모름|글쎄|확실하지|잘은 몰/u;

const relevantAnswer: Readonly<Record<string, RegExp>> = {
  cough_general: /오늘|어제|그제|방금|아까|아침|저녁|밤|\d+|마른|가래|목|열/u,
  nasal_symptom_general: /오늘|어제|그제|방금|\d+|콧물|막힘|재채기|양쪽|한쪽/u,
  sore_throat: /오늘|어제|그제|방금|\d+|삼킬|따끔|열|기침/u,
  dyspepsia_general: /윗배|명치|속|쓰리|더부룩|체한|오늘|어제|\d+/u,
  abdominal_pain_general:
    /윗배|아랫배|배꼽|전체|왼쪽|오른쪽|쓰리|쥐어|콕콕|오늘|어제|\d+/u,
  bowel_urgency_general: /묽|설사|안 나|변비|딱딱|횟수|\d+/u,
  musculoskeletal_pain: /움직|다치|부딪|붓|뜨거|가만|삐끗|오늘|어제|\d+/u,
  skin_general: /팔|다리|얼굴|몸|손|발|등|배|가려|진물|아프|오늘|어제|\d+/u,
  fever_general: /\d+\s*(?:살|세|도)|아이|성인|어른|체온/u,
};

const easierQuestion: Readonly<Record<string, string>> = {
  cough_general:
    "정확하지 않아도 괜찮아요. 오늘·어제·그보다 전 중 언제쯤 시작됐나요?",
  nasal_symptom_general:
    "정확하지 않아도 괜찮아요. 콧물과 코막힘 중 어느 쪽이 더 불편한가요?",
  sore_throat: "정확하지 않아도 괜찮아요. 침을 삼킬 때 더 아픈지만 알려주세요.",
  dyspepsia_general:
    "속이 쓰린 느낌과 더부룩한 느낌 중 어느 쪽에 더 가까운가요?",
  abdominal_pain_general:
    "정확하지 않아도 괜찮아요. 윗배·아랫배·배 전체 중 어디가 가장 불편한가요?",
  bowel_urgency_general:
    "묽은 변이 나오는 쪽인가요, 마려운데 잘 안 나오는 쪽인가요?",
  musculoskeletal_pain: "움직일 때 더 아픈가요, 가만히 있어도 아픈가요?",
  skin_general: "정확하지 않아도 괜찮아요. 가장 가려운 부위 하나만 알려주세요.",
  fever_general:
    "체온계로 잰 온도와 나이만 알려주세요. 모르면 대략적인 연령대도 괜찮아요.",
};

const explicitIntentPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/어깨|허리|무릎|관절|근육|손목|발목/u, "musculoskeletal_pain"],
  [/설사|묽은 변|변비|대변|똥/u, "bowel_urgency_general"],
  [/속쓰림|소화|더부룩|명치|체했/u, "dyspepsia_general"],
  [/아랫배|윗배|복통|배가?\s*아/u, "abdominal_pain_general"],
  [/목이?\s*아|인후|삼키/u, "sore_throat"],
  [/콧물|코막힘|재채기/u, "nasal_symptom_general"],
  [/기침|가래/u, "cough_general"],
  [/피부|가려|발진|습진/u, "skin_general"],
  [/열이?\s*나|발열|체온|몸살/u, "fever_general"],
];

const detectExplicitIntent = (text: string): string | null =>
  explicitIntentPatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;

const intentSeed: Readonly<Record<string, string>> = {
  musculoskeletal_pain: "어깨가 아파요",
  bowel_urgency_general: "설사할 것 같아요",
  dyspepsia_general: "소화가 안 돼요",
  abdominal_pain_general: "배가 아파요",
  sore_throat: "목이 아파요",
  nasal_symptom_general: "콧물이 나요",
  cough_general: "기침이 나요",
  skin_general: "피부가 가려워요",
  fever_general: "열이 나요",
};

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
    const explicitIntent = detectExplicitIntent(input.text);
    const startsDifferentTopic = Boolean(
      memory && explicitIntent && explicitIntent !== memory.activeIntent,
    );
    const prior = startsDifferentTopic ? [] : (memory?.turns ?? []);
    const turns = [...prior, input.text].slice(-4);
    const combined = turns.join(" ").slice(-2_000);
    const result = startsDifferentTopic
      ? this.engine.run({
          ...input,
          text: intentSeed[explicitIntent ?? ""] ?? input.text,
        })
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
    const latestIsUncertain = uncertainPattern.test(input.text);
    const answerIsRelevant = Boolean(
      memory?.activeIntent &&
      relevantAnswer[memory.activeIntent]?.test(input.text),
    );
    const routineClarification =
      result.ruleIds.includes("ASK_ONE") &&
      result.ruleIds.every((rule) => rule === "ASK_ONE");
    const durationIncluded =
      /(?:\d+|한|두|세|네)\s*(?:시간|일|주|개월)(?:째|간)?/u.test(combined);
    if (result.output.red_flags.length > 0) return remember(result);
    if (
      memory?.activeIntent &&
      !startsDifferentTopic &&
      (latestIsUncertain || !answerIsRelevant)
    ) {
      const question =
        easierQuestion[memory.activeIntent] ??
        "정확하지 않아도 괜찮아요. 지금 가장 불편한 점 하나만 말씀해 주세요.";
      return remember({
        ...result,
        output: {
          ...result.output,
          mode: "clarify",
          status: "blocked",
          intent: memory.activeIntent,
          say_now: latestIsUncertain
            ? ["괜찮아요. 정확히 모르셔도 됩니다."]
            : ["방금 말씀해 주신 내용도 참고할게요."],
          ask_next: [
            {
              question,
              reason: "자유 응답 재해석",
              priority: 1,
              slot: "clarification",
            },
          ],
          actions: [],
          missing_slots: ["clarification"],
        },
      });
    }
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
      turns.length < 2 ||
      (!answerIsRelevant && !durationIncluded)
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
