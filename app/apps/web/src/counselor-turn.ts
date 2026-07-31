import type { RuntimeOutput } from "@pharmassist/contracts";
import { isPatientFacingText } from "./consult-memory.js";

/**
 * The counselor's words are written by the model; what may be said is fixed by
 * the engine. This module is the referee between them: it publishes the
 * boundary a composed turn has to stay inside, and rejects any turn that
 * leaves it. Rejection is never a failure mode — the deterministic sentence
 * the engine already produced is displayed instead.
 */

/**
 * Every counselor question carries this slot. Nothing reads it back: what to
 * ask is the counselor's judgement, and the engine no longer keeps a ledger of
 * which question is outstanding. It exists because the runtime contract wants
 * a slot on every question.
 */
export const counselorAskSlot = "counselor.followup";

export interface CounselorBoundary {
  /** Products the engine chose this turn — the only ones nameable. */
  readonly allowedProducts: readonly string[];
  /** Ingredients behind those products. */
  readonly allowedIngredients: readonly string[];
  /** Every product name in the pack, to catch a name from another decision. */
  readonly knownProducts: readonly string[];
  /** No product may be named: a referral, or no verified candidate yet. */
  readonly mustNotNameProduct: boolean;
  /**
   * The consultation must be handed to a person. Distinct from having no
   * product to name yet — a turn still gathering information is an ordinary
   * question, and telling that customer to see a doctor would be wrong.
   */
  readonly referralRequired: boolean;
}

export interface ComposedCounselorTurn {
  readonly say: string;
  /** The counselor's own question, or null when it asks nothing this turn. */
  readonly ask: string | null;
}

export type CounselorVerdict =
  | { readonly status: "accepted"; readonly turn: ComposedCounselorTurn }
  | { readonly status: "rejected"; readonly reasons: readonly string[] };

// A dose is a clinical instruction, never narration. Mirrors the golden-gate
// pattern so an accepted turn can never state one.
// 씩 is part of the dose ("2정씩"); the trailing guard still keeps a bare
// quantity like 1정도 — about one — from reading as an instruction.
const dosagePattern =
  /\b\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc)\b|\d+\s*(?:정|알|캡슐|포|스푼)씩?(?![가-힣])|\d+\s*회\s*(?:씩|복용|투여)|하루\s*\d+\s*번/iu;

// Engine and authoring vocabulary that must never reach a customer's ears.
const internalVocabulary =
  /지식팩|데이터베이스|스키마|슬롯|프로토콜|규칙\s*id|형식으로|분류표|판정|엔진|시스템|모델|후보군\s*배열|option|rule_id/iu;

const maxSayLength = 220;
const maxAskLength = 120;
const referralLanguage =
  /(?:병원|의원|응급실|의료진|약사|약국).{0,30}(?:가(?:세요|셔야|는\s*게)|방문(?:하세요|하셔야|해\s*보)|찾아가|확인받|상담받|보이세요|문의하세요)|(?:진료|검사|직접\s*평가).{0,12}(?:받|우선|필요)|119/u;

/**
 * Products the engine has cleared for this turn's counselor. A provisional
 * candidate stays outside the decision so the retry contract remains intact,
 * but it is still the engine's own safe fallback and must reach the counselor
 * when the customer asks to stop questioning.
 */
export const counselorProductCandidates = (
  output: RuntimeOutput,
): RuntimeOutput["decision"]["product_candidates"] => {
  const referralRequired =
    output.mode === "escalate" || output.decision.status === "refer";
  if (referralRequired) return [];
  return output.decision.product_candidates.length > 0
    ? output.decision.product_candidates
    : (output.provisional_candidates ?? []);
};

/**
 * What the engine will allow this turn. `packProductNames` is every product
 * the pack knows; a name from that list outside `allowedProducts` means the
 * model reached for a decision the engine did not make.
 */
export const counselorBoundary = (
  output: RuntimeOutput,
  packProductNames: readonly string[],
): CounselorBoundary => {
  const referralRequired =
    output.mode === "escalate" || output.decision.status === "refer";
  const candidates = counselorProductCandidates(output);
  // A combination's supportive product is frequently outside the displayed
  // five, and the referee would otherwise read it as a name the engine never
  // chose — refusing every turn that offered the pair the engine itself built.
  const allowedProducts = [
    ...new Set([
      ...candidates.map((item) => item.display_name),
      ...(referralRequired
        ? []
        : (output.decision.combination_candidates ?? []).flatMap((pair) => [
            pair.primary_product_name,
            pair.supportive_product_name,
          ])),
    ]),
  ];
  return {
    referralRequired,
    allowedProducts,
    allowedIngredients: referralRequired
      ? []
      : output.decision.ingredient_options.map((item) => item.ingredient_name),
    knownProducts: packProductNames,
    // A referral has no product to offer. Otherwise, the counselor may name
    // only a candidate published through the decision or provisional channel.
    mustNotNameProduct: referralRequired || allowedProducts.length === 0,
  };
};

const namedProductsIn = (
  text: string,
  names: readonly string[],
): readonly string[] =>
  names.filter((name) => name.length > 1 && text.includes(name));

// Korean dosage forms with the shortest stem that still reads as a brand,
// longest form first so 연질캡슐 wins over 캡슐 and 현탁액 over 액. The
// single-syllable forms end a great many ordinary Korean words — 걱정, 안정,
// 재조정, 위산 — so they need a longer stem before a word is taken for a
// medicine. Lowering these numbers is what makes the rule refuse ordinary
// sentences; it was measured, not guessed.
const dosageForms: readonly Readonly<{ form: string; minimumStem: number }>[] =
  [
    ...[
      "연질캡슐",
      "경질캡슐",
      "츄어블정",
      "장용정",
      "현탁액",
      "점안액",
      "트로키",
      "서방정",
      "과립",
      "캡슐",
      "시럽",
      "연고",
      "크림",
      "로션",
      "좌제",
      "필름",
    ].map((form) => ({ form, minimumStem: 2 })),
    ...["정", "액", "산", "겔"].map((form) => ({ form, minimumStem: 3 })),
  ];

// Particles and copula endings that attach straight onto a noun, so that
// "부스코판정을" is read as the name 부스코판정 rather than dismissed.
const nounTail =
  /^(?:을|를|이|가|은|는|도|만|과|와|랑|이랑|의|에|에서|에게|으로|로|보다|처럼|부터|까지|이나|나|이라도|라도|입니다|이에요|예요|이야|야|이라고|라고|요)?$/u;

const wordsIn = (text: string): readonly string[] =>
  text.split(/[^0-9A-Za-z가-힣%]+/u).filter(Boolean);

/**
 * The medicine name a single word carries, if any. A word counts as a name
 * when a dosage form sits at its end under nothing but a particle, and enough
 * stem precedes the form to rule out an ordinary word: 걱정, 정도, 안정을 and
 * 재조정 all fall short, 부스코판정을 and 아나프록스시럽이 do not. A bare form
 * word — 시럽, 현탁액 — names nothing.
 */
const medicineNameIn = (word: string): string | null => {
  for (const { form, minimumStem } of dosageForms) {
    const at = word.lastIndexOf(form);
    if (at < 0) continue;
    if (!nounTail.test(word.slice(at + form.length))) continue;
    const stem = word.slice(0, at);
    if (stem.length === 0) return null;
    if (stem.length < minimumStem) continue;
    return stem + form;
  }
  return null;
};

/**
 * Long registered names carry a strength and an ingredient tail the counselor
 * would never speak — 타세놀정500밀리그램(아세트아미노펜) is said as 타세놀정
 * — so a supplied name is matched on its head as well as in full.
 */
const nameHead = (name: string): string =>
  name.split(/[(\d]/u)[0]?.trim() || name;

/**
 * Medicine names in the turn that the engine never put on the table. This is
 * what catches a name invented outright, which the pack-wide comparison cannot
 * see. It reads names by shape, so it only finds those carrying a dosage form:
 * a bare invented brand — 베나드릴, 판피린 — still passes, and closing that
 * would take a morphological analyser or a dictionary this bundle does not
 * carry.
 */
const unverifiedMedicineNames = (
  text: string,
  allowed: readonly string[],
): readonly string[] => {
  const permitted = new Set(allowed.flatMap((name) => [name, nameHead(name)]));
  return [
    ...new Set(
      wordsIn(text)
        .map(medicineNameIn)
        .filter((name): name is string => name !== null)
        .filter((name) => !permitted.has(name)),
    ),
  ];
};

/**
 * Decides whether the composed turn may be shown. Every rule is a fact the
 * engine already established, so a rejection means the model contradicted the
 * engine — not that it wrote badly.
 */
export const refereeCounselorTurn = (
  turn: ComposedCounselorTurn,
  boundary: CounselorBoundary,
): CounselorVerdict => {
  const reasons: string[] = [];
  const say = turn.say.trim();
  const ask = turn.ask?.trim() ?? "";
  const spoken = `${say} ${ask}`;

  if (!say || say.length > maxSayLength) reasons.push("SAY_LENGTH");
  if (ask.length > maxAskLength) reasons.push("ASK_LENGTH");
  if (!isPatientFacingText(say)) reasons.push("NOT_PATIENT_FACING");
  if (dosagePattern.test(spoken)) reasons.push("DOSAGE_STATED");
  if (internalVocabulary.test(spoken)) reasons.push("INTERNAL_VOCABULARY");
  if (!boundary.referralRequired && referralLanguage.test(spoken))
    reasons.push("REFERRAL_WITHOUT_REQUIREMENT");

  const offList = namedProductsIn(spoken, boundary.knownProducts).filter(
    (name) => !boundary.allowedProducts.includes(name),
  );
  if (offList.length > 0) reasons.push("OFF_LIST_PRODUCT");
  // A name the pack has never heard of cannot be checked against anything, so
  // it is refused on sight rather than reasoned about.
  if (
    unverifiedMedicineNames(spoken, [
      ...boundary.allowedProducts,
      ...boundary.allowedIngredients,
    ]).length > 0
  )
    reasons.push("UNVERIFIED_PRODUCT_NAME");
  if (
    boundary.mustNotNameProduct &&
    namedProductsIn(spoken, boundary.allowedProducts).length > 0
  )
    reasons.push("PRODUCT_NAMED_WITHOUT_CANDIDATE");

  // The question belongs in ask, where the pharmacist sees it as a question.
  // One inside say is either a duplicate of ask or a second question in the
  // same breath.
  if (/[?？]/u.test(say)) reasons.push("QUESTION_INSIDE_SAY");
  if (ask && !isPatientFacingText(ask)) reasons.push("ASK_NOT_PATIENT_FACING");

  return reasons.length > 0
    ? { status: "rejected", reasons }
    : { status: "accepted", turn: { say, ask: ask || null } };
};

/**
 * The engine's own turn, used whenever composition is refused or unavailable.
 * Keeping this as the floor is what makes an AI-led conversation safe to try.
 */
export const deterministicCounselorTurn = (
  output: RuntimeOutput,
): ComposedCounselorTurn => ({
  say: output.say_now[0] ?? "",
  ask: output.ask_next[0]?.question ?? null,
});

/**
 * Applies an accepted turn to the output the pharmacist sees. Whether to ask
 * anything is the counselor's call now: an accepted turn with no question
 * leaves none on screen, rather than the engine's own question being restored
 * behind it. That restoration is what made the consultation restate itself
 * turn after turn.
 */
export const withCounselorTurn = (
  output: RuntimeOutput,
  turn: ComposedCounselorTurn,
): RuntimeOutput => ({
  ...output,
  say_now: [turn.say] as RuntimeOutput["say_now"],
  ask_next: (turn.ask
    ? [
        {
          question: turn.ask,
          reason: "상담자가 이어서 확인",
          priority: 1,
          slot: counselorAskSlot,
        },
      ]
    : []) as RuntimeOutput["ask_next"],
});
