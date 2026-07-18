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
    ...output.ask_next.map((item) => item.question).filter(isPatientFacingText),
    ...output.say_now.filter(isPatientFacingText),
  ];
}
