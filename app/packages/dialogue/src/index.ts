export type DialogueSpeaker = "customer" | "counselor";

export interface DialogueTurn {
  readonly speaker: DialogueSpeaker;
  readonly text: string;
  readonly sequence: number;
}

export interface CustomerSummary {
  readonly facts: readonly string[];
  readonly symptoms: readonly string[];
  readonly duration: string | undefined;
  readonly risks: readonly string[];
}

export interface QuestionTemplateContext {
  readonly slots: Readonly<Record<string, unknown>>;
  readonly answeredSlots?: Readonly<Record<string, unknown>>;
}

export type ModelTurn = Readonly<{
  role: "user" | "assistant";
  content: string;
}>;

const transportPrefixes: Readonly<Record<DialogueSpeaker, readonly string[]>> =
  {
    customer: ["손님:", "환자:"],
    counselor: ["상담자:", "상담 도우미:", "약사:"],
  };

const symptomLabels: ReadonlyArray<readonly [RegExp, string]> = [
  [/기침|가래/u, "기침·가래"],
  [/배|복부|속쓰림|소화/u, "복부·소화"],
  [/어깨|허리|무릎|손목|발목|팔꿈치|고관절|근육|관절/u, "근육·관절"],
  [/목|인후/u, "목 통증"],
  [/코|콧물|코막힘/u, "코 증상"],
  [/피부|가려|발진/u, "피부 증상"],
];

const riskPattern = /숨|호흡|의식|실신|피가|혈변|토혈|마비|경련/u;
const durationPattern =
  /(?:오늘|어제|그제|방금|아까|며칠|일주일|한달|\d+\s*(?:시간|일|주|개월))(?:부터|째)?/u;
const nonFactPattern =
  /모르|몰라|애매|기억 안|글쎄|확실하지|그냥 그래|무슨 말|왜요|뭔가요|^(?:어이|저기(?:요)?|여보세요|안녕(?:하세요)?|하이|헬로|고마워(?:요)?|감사(?:합니다|해요)?|땡큐)[.!?~ ]*$|^(?:아니\s*)?(?:그거|그쪽|앞(?:에|쪽)?|뒤(?:에|쪽)?|처음|마지막|전자|후자|\d+\s*번|[첫둘셋넷]째|[첫두세네]\s*번째)(?:라고요|요)?[.!?]?$/u;

export function customerTurn(text: string, sequence: number): DialogueTurn {
  return { speaker: "customer", text: text.trim(), sequence };
}

export function upsertCounselorTurn(
  turns: readonly DialogueTurn[],
  sequence: number,
  text: string,
): readonly DialogueTurn[] {
  const next: DialogueTurn = {
    speaker: "counselor",
    text: text.trim(),
    sequence,
  };
  const index = turns.findIndex(
    (turn) => turn.speaker === "counselor" && turn.sequence === sequence,
  );
  if (index < 0) return [...turns, next];
  return turns.map((turn, turnIndex) => (turnIndex === index ? next : turn));
}

export function serializeDialogueTurns(
  turns: readonly DialogueTurn[],
): readonly string[] {
  return turns.map(
    (turn) =>
      `${turn.speaker === "customer" ? "손님" : "상담자"}: ${turn.text}`,
  );
}

export function parseDialogueTurns(turns: readonly string[]): DialogueTurn[] {
  return turns.flatMap((raw, index) => {
    const match = (Object.keys(transportPrefixes) as DialogueSpeaker[]).find(
      (speaker) =>
        transportPrefixes[speaker].some((prefix) => raw.startsWith(prefix)),
    );
    if (!match) return [];
    const prefix = transportPrefixes[match].find((item) =>
      raw.startsWith(item),
    );
    const text = prefix ? raw.slice(prefix.length).trim() : "";
    return text ? [{ speaker: match, text, sequence: index + 1 }] : [];
  });
}

export function toModelConversation(
  turns: readonly DialogueTurn[],
): readonly ModelTurn[] {
  return turns
    .filter((turn) => turn.text.trim().length > 0)
    .map((turn) => ({
      role: turn.speaker === "customer" ? "user" : "assistant",
      content: turn.text.trim(),
    }));
}

export function buildCustomerSummary(
  turns: readonly DialogueTurn[],
): CustomerSummary {
  const facts = [
    ...new Set(
      turns
        .filter((turn) => turn.speaker === "customer")
        .map((turn) => turn.text.trim())
        .filter((fact) => fact.length > 0 && !nonFactPattern.test(fact)),
    ),
  ];
  const joined = facts.join(" ");
  return {
    facts,
    symptoms: symptomLabels
      .filter(([pattern]) => pattern.test(joined))
      .map(([, label]) => label),
    duration: [...facts].reverse().find((fact) => durationPattern.test(fact)),
    risks: facts.filter((fact) => riskPattern.test(fact)),
  };
}

const valueOf = (value: unknown): unknown =>
  value && typeof value === "object" && "value" in value
    ? (value as Readonly<{ value: unknown }>).value
    : value;

const lastPronouncedCharacter = (value: string): string | undefined =>
  [...value.trim()]
    .reverse()
    .find((character) => /[가-힣0-9A-Za-z]/u.test(character));

const hasFinalConsonant = (value: string): boolean => {
  const last = lastPronouncedCharacter(value);
  if (!last) return false;
  if (/[가-힣]/u.test(last))
    return ((last.codePointAt(0) ?? 0) - 0xac00) % 28 !== 0;
  if (/[0-9]/u.test(last))
    return new Set(["0", "1", "3", "6", "7", "8"]).has(last);
  return new Set(["F", "L", "M", "N", "R", "S", "X"]).has(last.toUpperCase());
};

const withParticle = (value: string, particle: string | undefined): string => {
  const final = hasFinalConsonant(value);
  switch (particle) {
    case "topic":
      return `${value}${final ? "은" : "는"}`;
    case "subject":
      return `${value}${final ? "이" : "가"}`;
    case "object":
      return `${value}${final ? "을" : "를"}`;
    case "with":
      return `${value}${final ? "과" : "와"}`;
    default:
      return value;
  }
};

const templatePattern = /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}|]+))?\}\}/gu;

export function renderQuestionTemplate(
  template: string,
  context: QuestionTemplateContext,
): string {
  return template.replace(
    templatePattern,
    (_token, rawSlot: string, rawFallback: string, rawParticle?: string) => {
      const slot = rawSlot.trim();
      const fallback = rawFallback.trim();
      const candidateKeys = [slot, slot.split(".").at(-1)].filter(
        (key): key is string => Boolean(key),
      );
      const raw = candidateKeys
        .map(
          (key) =>
            context.slots[key] ?? context.answeredSlots?.[key] ?? undefined,
        )
        .find((value) => value !== undefined && value !== null && value !== "");
      const resolved = valueOf(raw);
      const value =
        typeof resolved === "string" || typeof resolved === "number"
          ? String(resolved)
          : fallback;
      return withParticle(value, rawParticle?.trim());
    },
  );
}
