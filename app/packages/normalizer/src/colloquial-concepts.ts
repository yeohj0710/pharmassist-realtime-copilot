interface ColloquialConceptRule {
  readonly conceptId: string;
  readonly subjectPattern: string;
  readonly predicatePattern: string;
  readonly canonicalText: string;
}

// These rules describe composable symptom concepts, not complete utterances.
// A concept grows by adding a subject or predicate form without adding every
// possible full sentence as a special case.
const conceptRules: readonly ColloquialConceptRule[] = [
  {
    conceptId: "bowel_urgency",
    subjectPattern: "(?:똥|대변|변|화장실)",
    predicatePattern:
      "(?:마려(?:워요|운데|우면|운|워|움|울|요)?|급하(?:다|고|네|니|냐)?|급해(?:요)?)",
    canonicalText: "변이 마려워요",
  },
  {
    conceptId: "abdominal_pain",
    subjectPattern: "배",
    predicatePattern: "(?:아프(?:노|다|네|구나|구만|냐|니)?|아픈데)",
    canonicalText: "배가 아파요",
  },
  {
    conceptId: "heartburn",
    subjectPattern: "속",
    predicatePattern: "쓰리(?:노|다|네|구나|구만|냐|니)",
    canonicalText: "속이 쓰려요",
  },
  {
    conceptId: "headache",
    subjectPattern: "머리",
    predicatePattern: "(?:아프(?:노|다|네|구나|구만|냐|니)?|아픈데)",
    canonicalText: "머리가 아파요",
  },
  {
    conceptId: "cough",
    subjectPattern: "기침",
    predicatePattern: "나(?:노|다|네|구나|구만|냐|니)",
    canonicalText: "기침나요",
  },
  {
    conceptId: "diarrhea",
    subjectPattern: "설사",
    predicatePattern: "하(?:노|다|네|구나|구만|냐|니)",
    canonicalText: "설사해요",
  },
  {
    conceptId: "nasal_congestion",
    subjectPattern: "코",
    predicatePattern: "막히(?:노|다|네|구나|구만|냐|니)",
    canonicalText: "코막혀요",
  },
  {
    conceptId: "runny_nose",
    subjectPattern: "콧물",
    predicatePattern: "나(?:노|다|네|구나|구만|냐|니)",
    canonicalText: "콧물나요",
  },
];

const compiledConceptRules = conceptRules.map((rule) => ({
  ...rule,
  expression: new RegExp(
    `${rule.subjectPattern}\\s*(?:이|가)?\\s*${rule.predicatePattern}`,
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
