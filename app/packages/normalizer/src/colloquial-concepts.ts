interface ColloquialConceptRule {
  readonly conceptId: string;
  readonly subjectPattern: string;
  readonly predicatePattern: string;
  readonly canonicalText: string;
}

// Particles that may follow the subject noun. A shared alternation means a new
// particle ("속도 쓰려요") is covered once for every concept instead of per
// sentence.
const subjectParticles = "(?:이|가|은|는|도|만|을|를)?";

// Intensity adverbs may sit between the subject and the predicate ("코가 꽉
// 막혔어요"). Negating adverbs (안, 못) stay out so a denial never matches.
const intensityAdverbs =
  "(?:\\s*(?:꽉|콱|너무|계속|자꾸|많이|엄청|되게|좀|조금|살짝|약간|심하게))*";

// A denial must never canonicalize into a positive symptom, so every verb stem
// is guarded against the common negation endings before the bounded ending.
const notNegated = "(?!지\\s*않|진\\s*않|지는\\s*않|기\\s*싫)";

// Builds a predicate from verb-stem variants (including contracted forms).
// Growing coverage means adding a stem variant here, never a full sentence.
const stemPredicate = (stems: readonly string[]): string =>
  `(?:${stems.join("|")})${notNegated}[가-힣]{0,4}`;

// The "나-" family is ambiguous with recovery wording (나아요, 나았어요), so
// occurrence endings are enumerated instead of using the generic bounded
// ending.
const occurrencePredicate = `(?:나(?:요|다|네|노|고|는데|니|냐|구나|구만)|나오${notNegated}[가-힣]{0,3}|나와${notNegated}[가-힣]{0,3}|났[가-힣]{0,3}|심하[가-힣]{0,4}|심해[가-힣]{0,3})`;

// These rules describe composable symptom concepts, not complete utterances.
// A concept grows by adding a subject or predicate form without adding every
// possible full sentence as a special case.
// Pain predicates shared by the body-site concepts below.
const painStems = ["아프", "아파", "아픈"] as const;

const conceptRules: readonly ColloquialConceptRule[] = [
  {
    conceptId: "bowel_urgency",
    subjectPattern: "(?:똥|대변|변|화장실)",
    predicatePattern: stemPredicate(["마렵", "마려", "급하", "급해"]),
    canonicalText: "변이 마려워요",
  },
  {
    conceptId: "abdominal_pain",
    subjectPattern: "배",
    predicatePattern: stemPredicate([...painStems]),
    canonicalText: "배가 아파요",
  },
  {
    conceptId: "bloating",
    subjectPattern: "(?:아랫배|윗배|속|배)",
    predicatePattern: stemPredicate(["더부룩", "빵빵", "팽만", "얹혔", "얹힌"]),
    canonicalText: "더부룩함이 있어요",
  },
  {
    conceptId: "heartburn",
    subjectPattern: "속",
    predicatePattern: stemPredicate(["쓰리", "쓰려", "쓰린"]),
    canonicalText: "속이 쓰려요",
  },
  {
    conceptId: "headache",
    subjectPattern: "머리",
    predicatePattern: stemPredicate([...painStems]),
    canonicalText: "머리가 아파요",
  },
  {
    conceptId: "sore_throat",
    subjectPattern: "목(?:구멍|안)?",
    predicatePattern: stemPredicate([
      ...painStems,
      "아픔",
      "따갑",
      "따가",
      "따끔",
      "칼칼",
      "컬컬",
      "붓",
      "부었",
      "부어",
      "잠기",
      "잠겨",
    ]),
    canonicalText: "인후통이 있어요",
  },
  {
    conceptId: "dry_eye",
    subjectPattern: "눈",
    predicatePattern: stemPredicate(["건조", "뻑뻑", "마르", "말라"]),
    canonicalText: "안구건조가 있어요",
  },
  {
    conceptId: "phlegm_cough",
    subjectPattern: "(?:가래|객담)",
    predicatePattern: `(?:끓${notNegated}[가-힣]{0,4}|나오${notNegated}[가-힣]{0,3}|나와${notNegated}[가-힣]{0,3}|끼${notNegated}[가-힣]{0,3}|낀[가-힣]{0,2}|껴${notNegated}[가-힣]{0,2}|많${notNegated}[가-힣]{0,3}|생기${notNegated}[가-힣]{0,3})`,
    canonicalText: "가래기침이에요",
  },
  {
    conceptId: "cough",
    subjectPattern: "기침",
    predicatePattern: occurrencePredicate,
    canonicalText: "기침나요",
  },
  {
    conceptId: "diarrhea",
    subjectPattern: "설사",
    predicatePattern: `(?:해요|했[가-힣]{0,3}|하(?:다|네|노|고|는데|니|냐|구나|구만)|합니다|나요|나와요)`,
    canonicalText: "설사해요",
  },
  {
    conceptId: "nasal_congestion",
    subjectPattern: "코",
    predicatePattern: stemPredicate(["막히", "막혀", "막힌", "막힘", "막혔"]),
    canonicalText: "코막힘이 있어요",
  },
  {
    conceptId: "runny_nose",
    subjectPattern: "콧물",
    predicatePattern: `(?:${occurrencePredicate}|흐르${notNegated}[가-힣]{0,3}|흘러${notNegated}[가-힣]{0,3})`,
    canonicalText: "콧물나요",
  },
  {
    conceptId: "stomatitis",
    subjectPattern: "(?:입\\s*안|입술|입|혀)",
    predicatePattern: `(?:헐${notNegated}[가-힣]{0,4}|까졌[가-힣]{0,2}|까져${notNegated}[가-힣]{0,2}|덧나${notNegated}[가-힣]{0,3})`,
    canonicalText: "구내염이 있어요",
  },
];

// The leading lookbehind keeps a one-syllable subject from matching inside a
// compound noun: 손목/발목 must never canonicalize as throat (목), and 숙변
// must never canonicalize as bowel urgency (변).
const compiledConceptRules = conceptRules.map((rule) => ({
  ...rule,
  expression: new RegExp(
    `(?<![가-힣])(?:${rule.subjectPattern})\\s*${subjectParticles}${intensityAdverbs}\\s*${rule.predicatePattern}`,
    "gu",
  ),
}));

export function normalizeColloquialConcepts(text: string): string {
  return compiledConceptRules.reduce(
    (normalized, rule) =>
      normalized.replace(rule.expression, rule.canonicalText),
    text,
  );
}
