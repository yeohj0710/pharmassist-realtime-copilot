import type { RuntimeOutput } from "@pharmassist/contracts";
import { isPatientFacingText } from "./consult-memory.js";

/**
 * The counselor's words are written by the model; what may be said is fixed by
 * the engine. This module is the referee between them: it publishes the
 * boundary a composed turn has to stay inside, and rejects any turn that
 * leaves it. Rejection is never a failure mode — the deterministic sentence
 * the engine already produced is displayed instead.
 */

/** Always offerable: the counselor may ask for the complaint in plain words. */
export const openEndedSlot = "patient.detail";

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
  /** The engine cannot proceed without an answer, whatever the model prefers. */
  readonly questionRequired: boolean;
  /** Slots the counselor may put a question on. */
  readonly askableSlots: readonly string[];
}

export interface ComposedCounselorTurn {
  readonly say: string;
  readonly ask: string | null;
  readonly askSlot: string | null;
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

/**
 * What the engine will allow this turn. `packProductNames` is every product
 * the pack knows; a name from that list outside `allowedProducts` means the
 * model reached for a decision the engine did not make.
 */
export const counselorBoundary = (
  output: RuntimeOutput,
  packProductNames: readonly string[],
): CounselorBoundary => {
  const allowedProducts = output.decision.product_candidates.map(
    (item) => item.display_name,
  );
  const factSlots = (output.fact_targets ?? []).map((target) => target.slot);
  const askedSlot = output.ask_next[0]?.slot;
  const referralRequired =
    output.mode === "escalate" || output.decision.status === "refer";
  return {
    referralRequired,
    questionRequired:
      output.decision.status === "ask" && output.ask_next.length > 0,
    allowedProducts,
    allowedIngredients: output.decision.ingredient_options.map(
      (item) => item.ingredient_name,
    ),
    knownProducts: packProductNames,
    // A referral or an unresolved decision has no product to offer, whatever
    // candidates happen to be attached for the pharmacist's own review.
    mustNotNameProduct: referralRequired || allowedProducts.length === 0,
    askableSlots: [
      ...new Set([
        ...(askedSlot ? [askedSlot] : []),
        ...factSlots,
        openEndedSlot,
      ]),
    ],
  };
};

const namedProductsIn = (
  text: string,
  names: readonly string[],
): readonly string[] =>
  names.filter((name) => name.length > 1 && text.includes(name));

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

  const offList = namedProductsIn(spoken, boundary.knownProducts).filter(
    (name) => !boundary.allowedProducts.includes(name),
  );
  if (offList.length > 0) reasons.push("OFF_LIST_PRODUCT");
  if (
    boundary.mustNotNameProduct &&
    namedProductsIn(spoken, boundary.allowedProducts).length > 0
  )
    reasons.push("PRODUCT_NAMED_WITHOUT_CANDIDATE");

  // A question the engine cannot record is a question that repeats forever.
  if (turn.askSlot && !boundary.askableSlots.includes(turn.askSlot))
    reasons.push("ILLEGAL_ASK_SLOT");
  if (ask && !turn.askSlot) reasons.push("ASK_WITHOUT_SLOT");
  // The question belongs in ask, where it gets a slot and can be recorded. A
  // question inside say is either a duplicate of ask or one the engine will
  // never see the answer to.
  if (/[?？]/u.test(say)) reasons.push("QUESTION_INSIDE_SAY");
  if (ask && !isPatientFacingText(ask)) reasons.push("ASK_NOT_PATIENT_FACING");

  return reasons.length > 0
    ? { status: "rejected", reasons }
    : {
        status: "accepted",
        turn: {
          say,
          ask: ask || null,
          askSlot: ask ? turn.askSlot : null,
        },
      };
};

/**
 * The engine's own turn, used whenever composition is refused or unavailable.
 * Keeping this as the floor is what makes an AI-led conversation safe to try.
 */
export const deterministicCounselorTurn = (
  output: RuntimeOutput,
): ComposedCounselorTurn => {
  const asked = output.ask_next[0];
  return {
    say: output.say_now[0] ?? "",
    ask: asked?.question ?? null,
    askSlot: asked?.slot ?? null,
  };
};

/**
 * Applies an accepted turn to the output the pharmacist sees. The counselor
 * chooses which question to ask and how to word it; whether one is needed at
 * all stays with the engine, so a decision that cannot proceed without an
 * answer keeps its question even when the model offered none.
 */
export const withCounselorTurn = (
  output: RuntimeOutput,
  turn: ComposedCounselorTurn,
): RuntimeOutput => ({
  ...output,
  say_now: [turn.say] as RuntimeOutput["say_now"],
  ask_next: (turn.ask && turn.askSlot
    ? [
        {
          question: turn.ask,
          reason: output.ask_next[0]?.reason ?? "상담 진행에 필요한 확인",
          priority: 1,
          slot: turn.askSlot,
        },
      ]
    : output.decision.status === "ask"
      ? output.ask_next
      : []) as RuntimeOutput["ask_next"],
});
