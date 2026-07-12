export interface PatientSummary {
  readonly facts: readonly string[];
  readonly symptoms: readonly string[];
  readonly duration: string | undefined;
  readonly risks: readonly string[];
}

const symptomLabels: ReadonlyArray<readonly [RegExp, string]> = [
  [/기침|가래/u, "기침·가래"],
  [/배|복부|속쓰림|소화/u, "복부·소화"],
  [/어깨|허리|무릎|손목|발목|근육|관절/u, "근육·관절"],
  [/목|인후/u, "목 통증"],
  [/코|콧물|코막힘/u, "코 증상"],
  [/피부|가려|발진/u, "피부 증상"],
];

const riskPattern = /숨|호흡|의식|실신|피가|혈변|토혈|마비|경련/u;
const durationPattern =
  /(?:오늘|어제|그제|방금|아까|며칠|일주일|한달|\d+\s*(?:시간|일|주|개월))(?:부터|째)?/u;

export function upsertAssistantTurn(
  turns: readonly string[],
  _sequence: number,
  text: string,
): readonly string[] {
  const entry = `상담 도우미: ${text}`;
  if (turns.at(-1)?.startsWith("상담 도우미:"))
    return [...turns.slice(0, -1), entry];
  return [...turns, entry];
}

export function buildPatientSummary(turns: readonly string[]): PatientSummary {
  const facts = [
    ...new Set(
      turns
        .filter((turn) => turn.startsWith("환자:"))
        .map((turn) => turn.slice("환자:".length).trim())
        .filter(Boolean),
    ),
  ];
  const joined = facts.join(" ");
  const symptoms = symptomLabels
    .filter(([pattern]) => pattern.test(joined))
    .map(([, label]) => label);
  const duration = [...facts]
    .reverse()
    .find((fact) => durationPattern.test(fact));
  const risks = facts.filter((fact) => riskPattern.test(fact));
  return { facts, symptoms, duration, risks };
}

export function outputText(output: {
  readonly say_now: readonly string[];
  readonly ask_next: ReadonlyArray<Readonly<{ question: string }>>;
  readonly actions: ReadonlyArray<Readonly<{ text: string }>>;
}): string {
  return [
    ...output.say_now,
    ...output.ask_next.map((question) => question.question),
  ]
    .filter(Boolean)
    .join(" ");
}

const internalInstructionPattern =
  /비교하세요|확인한다|평가한다|검토한다|출력하지|판매를? 중단|약사 내부|성분군 후보/u;

export function isPatientFacingText(text: string): boolean {
  return text.trim().length > 0 && !internalInstructionPattern.test(text);
}

export function patientVisibleLines(output: {
  readonly say_now: readonly string[];
  readonly ask_next: ReadonlyArray<Readonly<{ question: string }>>;
  readonly actions?: ReadonlyArray<Readonly<{ text: string }>>;
}): readonly string[] {
  return [
    ...output.say_now.filter(isPatientFacingText),
    ...output.ask_next.map((item) => item.question).filter(isPatientFacingText),
  ];
}
