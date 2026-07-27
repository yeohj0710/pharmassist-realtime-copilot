import type {
  NormalizedInput,
  PersonScope,
  RedactionFinding,
  SlotEvidence,
  Temporality,
} from "@pharmassist/domain";
import { normalizeColloquialConcepts } from "./colloquial-concepts.js";

const zeroWidthAndControls =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/gu;
const phone =
  /(?<!\d)(?:01[016789][ -]?\d{3,4}[ -]?\d{4}|0\d{1,2}[ -]?\d{3,4}[ -]?\d{4})(?!\d)/gu;
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const rrn = /(?<!\d)\d{6}[ -]?[1-8]\d{6}(?!\d)/gu;
const payment = /(?<!\d)(?:\d[ -]?){15,19}(?!\d)/gu;
const address =
  /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s,]{0,12}(?:로|길|동)\s?\d{1,4}(?:-\d{1,4})?/gu;

function collect(
  text: string,
  pattern: RegExp,
  kind: RedactionFinding["kind"],
): RedactionFinding[] {
  return [...text.matchAll(pattern)].map((match) => ({
    kind,
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export interface RedactionResult {
  readonly text: string;
  readonly findings: readonly RedactionFinding[];
  readonly safeForExternal: boolean;
}

export function redactPii(text: string): RedactionResult {
  const findings = [
    ...collect(text, phone, "phone"),
    ...collect(text, email, "email"),
    ...collect(text, rrn, "rrn"),
    ...collect(text, address, "address"),
    ...collect(text, payment, "payment"),
  ].sort((a, b) => a.start - b.start || b.end - a.end);
  const possibleName = /(?:성함|환자명|희귀\s*이름)/u.test(text);
  if (possibleName) findings.push({ kind: "possible_name", start: 0, end: 0 });
  let redacted = text;
  for (const finding of [...findings]
    .filter((item) => item.end > item.start)
    .sort((a, b) => b.start - a.start)) {
    redacted =
      redacted.slice(0, finding.start) +
      `[REDACTED_${finding.kind.toUpperCase()}]` +
      redacted.slice(finding.end);
  }
  return {
    text: redacted,
    findings,
    safeForExternal:
      !possibleName &&
      !findings.some((item) => item.kind === "rrn" || item.kind === "payment"),
  };
}

const koreanNumbers: Readonly<Record<string, number>> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
  십: 10,
};
function firstNumber(value: string): number | undefined {
  const numeric = value.match(/\d+(?:\.\d+)?/u)?.[0];
  if (numeric) return Number(numeric);
  for (const [word, number] of Object.entries(koreanNumbers))
    if (value.includes(word)) return number;
  return undefined;
}

// A customer answers "언제부터요?" with a counted span, a calendar word, a part
// of the day, or an event they woke up from — far more often than with the
// digit-and-unit wording alone ("이틀 됐어요", "엊그제요", "자고 일어나니까").
// The same source is used to extract the duration slot and to decide whether a
// turn answered a pending duration question, so the two can never drift apart.
const countedSpan =
  "(?:\\d+(?:\\.\\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|십|몇)\\s*(?:분|시간|일|주일|주|달|개월|년)(?:째|간|전|쯤|정도|여|남짓)?";
const namedSpan =
  "하루\\s*이틀|하루|이틀|사흘|나흘|닷새|엿새|이레|일주일|이주일|보름|한\\s*달|반나절";
const calendarPoint =
  "오늘|어제|어젯밤|엊저녁|엊그제|그저께|그끄저께|그제|지난주|저번\\s*주|이번\\s*주|주말|평일|작년|올해|며칠";
// A part of the day is a whole word only when a particle or a boundary follows
// it: without this guard 낮 matches 낮아요 and 밤 matches 밤새 unrelated turns.
const dayPart =
  "(?:새벽|아침|오전|점심|낮|오후|저녁|밤)(?=\\s|$|[에서부터쯤경엔때이가은는도만요])";
const onsetEvent =
  "방금|아까|조금\\s*전|자고\\s*일어나|일어나(?:니|서|보니)|자기\\s*전|먹고\\s*나서";

export const koreanDurationExpression = `(?:${countedSpan}|${namedSpan}|${calendarPoint}|${dayPart}|${onsetEvent})`;

function slot<T>(
  value: T,
  provenance: SlotEvidence["provenance"] = "derived",
  confidence = 0.9,
  verified = false,
  span?: readonly [number, number],
): SlotEvidence<T> {
  return { value, provenance, confidence, verified, ...(span ? { span } : {}) };
}

const anatomyLexicon: ReadonlyArray<
  Readonly<{ value: string; aliases: readonly string[] }>
> = [
  { value: "고관절", aliases: ["고관절", "엉덩이 관절", "골반 관절"] },
  { value: "팔꿈치", aliases: ["팔꿈치", "엘보"] },
  { value: "손가락", aliases: ["손가락", "손 마디"] },
  { value: "발가락", aliases: ["발가락", "발가락 마디"] },
  { value: "손목", aliases: ["손목"] },
  { value: "발목", aliases: ["발목"] },
  { value: "무릎", aliases: ["무릎", "슬관절"] },
  { value: "어깨", aliases: ["어깨", "견관절"] },
  { value: "허리", aliases: ["허리", "요추"] },
  { value: "허벅지", aliases: ["허벅지", "대퇴부"] },
  { value: "종아리", aliases: ["종아리"] },
  { value: "엉덩이", aliases: ["엉덩이", "둔부"] },
  { value: "등", aliases: ["등", "등쪽"] },
  { value: "목", aliases: ["목", "목덜미", "경추"] },
  { value: "팔", aliases: ["팔", "상완", "전완"] },
  { value: "다리", aliases: ["다리", "하지"] },
  { value: "손", aliases: ["손"] },
  { value: "발", aliases: ["발"] },
];

const bodySite = (
  text: string,
): Readonly<{ value: string; span: readonly [number, number] }> | undefined => {
  const candidates = anatomyLexicon.flatMap((entry) =>
    entry.aliases.map((alias) => ({ value: entry.value, alias })),
  );
  for (const candidate of candidates.sort(
    (left, right) => right.alias.length - left.alias.length,
  )) {
    const start = text.indexOf(candidate.alias);
    if (start >= 0)
      return {
        value: candidate.value,
        span: [start, start + candidate.alias.length],
      };
  }
  return undefined;
};

function extractSlots(text: string): Readonly<Record<string, SlotEvidence>> {
  const slots: Record<string, SlotEvidence> = {};
  const anatomicalSite = bodySite(text);
  if (anatomicalSite)
    slots["body_site"] = slot(
      anatomicalSite.value,
      "derived",
      0.95,
      false,
      anatomicalSite.span,
    );
  const age = text.match(
    /((?:\d+(?:\.\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|십)\s*(?:세|살))/u,
  )?.[0];
  if (age) slots["age_years"] = slot(firstNumber(age));
  const weight = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|킬로(?:그램)?)/iu);
  if (weight?.[1]) slots["weight_kg"] = slot(Number(weight[1]));
  const volume = text.match(/(\d+(?:\.\d+)?)\s*(?:mL|ml|미리|밀리|cc|씨씨)/iu);
  if (volume?.[1]) slots["volume_ml"] = slot(Number(volume[1]));
  const temperature = text.match(/(\d{2}(?:\.\d+)?)\s*(?:도|℃)/u);
  if (temperature?.[1]) slots["temperature_c"] = slot(Number(temperature[1]));
  const duration = text.match(
    new RegExp(`${koreanDurationExpression}(?:부터)?`, "u"),
  )?.[0];
  if (duration) slots["duration"] = slot(duration, "derived", 0.85, false);
  const concentration = text.match(
    /\d+(?:\.\d+)?\s*(?:mg|g)\s*\/\s*\d+(?:\.\d+)?\s*(?:mL|ml)/iu,
  )?.[0];
  if (concentration)
    slots["product_concentration"] = slot(concentration, "typed", 0.95, false);
  const pregnancyNegated =
    /임신(?:은|이)?\s*(?:아니|아님|가능성\s*(?:없|낮))/u.test(text);
  if (/임신/u.test(text))
    slots["pregnancy_status"] = slot(
      pregnancyNegated
        ? "not_pregnant"
        : /가능|일 수도|모르/u.test(text)
          ? "possible"
          : "pregnant",
    );
  const weeks = text.match(/임신\s*(\d{1,2})\s*주/u)?.[1];
  if (weeks) slots["gestational_weeks"] = slot(Number(weeks));
  if (/수유/u.test(text)) slots["lactation_status"] = slot("yes");
  const missed = text.match(
    /(?:연속\s*)?(\d+|한|두|세)\s*(?:정|알|일)\s*(?:빼먹|못 먹|누락)/u,
  )?.[1];
  if (missed) slots["missed_count"] = slot(firstNumber(missed));
  if (/제품명|제품은/u.test(text) && !/몰라/u.test(text))
    slots["product_name"] = slot("unverified_text", "typed", 0.5, false);
  return slots;
}

function personScope(text: string): PersonScope {
  if (/아버지|어머니|엄마|아빠|동행|친구|남편|아내/u.test(text)) return "other";
  if (/아이|아기|애기|소아|자녀/u.test(text)) return "child";
  return /저는|제가|내가|저/u.test(text) ? "self" : "unknown";
}

function temporality(text: string): Temporality {
  if (/작년|예전|과거|어제는.+(?:지금|현재).+(?:괜찮|없)/u.test(text))
    return "past";
  if (/일 수도|가능|같아/u.test(text)) return "possible";
  return "current";
}

const normalizeColloquialSymptoms = (text: string): string =>
  normalizeColloquialConcepts(text).replace(
    /소화\s*(?:가\s*)?안\s*된(?:다|다니까|다네|다노)/gu,
    "소화 안 돼요",
  );

export function normalizeKorean(
  text: string,
  alternatives: readonly string[] = [],
): NormalizedInput {
  const displayText = text
    .normalize("NFKC")
    .replace(zeroWidthAndControls, "")
    .replace(/\r\n?/gu, "\n")
    .trim();
  const normalizedText = normalizeColloquialSymptoms(
    displayText
      .replace(/씨씨/gu, "mL")
      .replace(/(?:미리|밀리)(?=\s|$)/gu, "mL")
      .replace(/킬로그램|킬로/gu, "kg")
      .replace(/[\t\n ]+/gu, " ")
      .replace(/\s*([,!?])\s*/gu, "$1 ")
      .trim()
      .toLowerCase()
      .replace(/\bml\b/giu, "mL"),
  );
  const redaction = redactPii(normalizedText);
  const tokens = normalizedText.split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
  return {
    displayText,
    normalizedText,
    redactedText: redaction.text,
    safeForExternal: redaction.safeForExternal,
    findings: redaction.findings,
    alternatives: [
      ...new Set(
        alternatives
          .map((item) => item.normalize("NFKC").trim())
          .filter(Boolean),
      ),
    ],
    tokens,
    slots: extractSlots(normalizedText),
    personScope: personScope(normalizedText),
    temporality: temporality(normalizedText),
  };
}

export function shouldSearchDuringComposition(
  isComposing: boolean,
  eventType: "input" | "compositionend",
): boolean {
  return !isComposing || eventType === "compositionend";
}

export interface SymptomEvidence {
  readonly state: "positive" | "negative" | "uncertain";
  readonly temporality: Temporality;
  readonly personScope: PersonScope;
}
export function classifyEvidence(
  text: string,
  symptomPattern: RegExp,
): SymptomEvidence {
  const normalized = normalizeKorean(text);
  const match = normalized.normalizedText.match(symptomPattern);
  if (!match)
    return {
      state: "negative",
      temporality: normalized.temporality,
      personScope: normalized.personScope,
    };
  const before = normalized.normalizedText.slice(
    Math.max(0, (match.index ?? 0) - 10),
    (match.index ?? 0) + match[0].length + 10,
  );
  const doubleNegative =
    /안\s*[^ ]{0,4}\s*(?:건|것은?)\s*아니|없(?:는|지)\s*건\s*아니/u.test(
      before,
    );
  const negated =
    /(?:안|않|없|아니|괜찮)[^.!?]{0,8}(?:숨|호흡|흉통|가슴)|(?:숨|호흡|흉통|가슴)[^.!?]{0,8}(?:안|않|없|아니|괜찮)/u.test(
      before,
    );
  return {
    state: doubleNegative ? "uncertain" : negated ? "negative" : "positive",
    temporality: normalized.temporality,
    personScope: normalized.personScope,
  };
}
