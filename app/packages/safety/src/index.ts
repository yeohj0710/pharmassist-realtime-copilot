import type {
  Domain,
  NormalizedInput,
  SafetyDecision,
} from "@pharmassist/domain";

interface RedFlagRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly action: "emergency" | "same_day" | "doctor" | "stop_and_verify";
  readonly label: string;
  readonly say: string;
}

const redFlagRules: readonly RedFlagRule[] = [
  {
    id: "RF-BREATHING",
    pattern:
      /숨이\s*안\s*쉬어|숨쉬기\s*(?:너무\s*)?힘들|말하기\s*힘들[^.!?]{0,8}숨|입술이?\s*파래|청색증/u,
    action: "emergency",
    label: "심한 호흡 곤란 신호",
    say: "지금은 약 선택보다 응급평가가 우선입니다. 즉시 119 또는 응급실 도움을 받으세요.",
  },
  {
    id: "RF-ANAPHYLAXIS",
    pattern:
      /(?:입술|목|혀|얼굴)(?:이|가|은|는)?\s*(?:갑자기\s*)?(?:부(?:었|어|음)|붓(?:고|거나|는))[^.!?]{0,18}(?:숨|호흡)|약\s*먹고\s*(?:입술|목|혀|얼굴)(?:이|가|은|는)?\s*(?:부|붓)/u,
    action: "emergency",
    label: "중증 알레르기 가능 신호",
    say: "심한 알레르기 반응 가능성을 배제할 수 없어 즉시 응급평가가 필요합니다.",
  },
  {
    id: "RF-CHEST",
    pattern:
      /가슴(?:이|을)?\s*(?:짓누르|심하게\s*아프|아프)[^.!?]{0,14}(?:식은땀|실신)|갑자기\s*심한\s*흉통/u,
    action: "emergency",
    label: "흉부 긴급 신호",
    say: "일반약보다 즉시 응급평가가 우선입니다.",
  },
  {
    id: "RF-CHEST-PAIN",
    pattern: /흉통|가슴(?:이|을)?\s*(?:아프|통증)/u,
    action: "same_day",
    label: "흉통 확인 필요",
    say: "기침과 함께 흉통이 있으면 일반약 선택보다 당일 의료평가가 우선입니다.",
  },
  {
    id: "RF-NEURO",
    pattern:
      /말이\s*(?:갑자기\s*)?어눌[^.!?]{0,18}(?:한쪽|팔|다리)|한쪽\s*(?:팔|다리)[^.!?]{0,10}힘이\s*없|갑자기\s*의식이\s*이상/u,
    action: "emergency",
    label: "급성 신경학적 신호",
    say: "급성 신경학적 이상 가능성이 있어 즉시 응급평가가 필요합니다.",
  },
  {
    id: "RF-GI-BLEED",
    pattern: /검은\s*변|흑변|피를?\s*토/u,
    action: "same_day",
    label: "출혈 가능 신호",
    say: "출혈 가능성을 확인해야 하므로 일반약 선택을 멈추고 즉시 의료평가를 받으세요.",
  },
  {
    id: "RF-DIARRHEA",
    pattern: /피\s*섞인\s*설사|혈변[^.!?]{0,12}(?:어지|축)/u,
    action: "same_day",
    label: "설사 중 위험 신호",
    say: "출혈이나 탈수 위험을 확인해야 하므로 의료평가가 우선입니다.",
  },
  {
    id: "RF-THROMBOSIS",
    pattern:
      /피임약[^.!?]{0,22}한쪽\s*다리[^.!?]{0,12}(?:붓|아프)|한쪽\s*다리[^.!?]{0,12}(?:붓|아프)[^.!?]{0,22}피임약/u,
    action: "same_day",
    label: "혈전 가능 신호",
    say: "한쪽 다리의 붓기와 통증은 즉시 의료평가가 필요한 신호일 수 있습니다.",
  },
  {
    id: "DURATION_REFERRAL",
    pattern: /기침(?:이)?\s*(?:4|네)\s*주(?:째|간)?/u,
    action: "doctor",
    label: "지속 기침",
    say: "기침이 오래 지속되어 원인 평가가 우선입니다.",
  },
  {
    id: "ALARM_FEATURE",
    pattern:
      /속쓰림[^.!?]{0,20}(?:두\s*달|2\s*개월)[^.!?]{0,18}(?:체중|살)[^.!?]{0,6}빠|(?:체중|살)[^.!?]{0,6}빠[^.!?]{0,18}속쓰림/u,
    action: "doctor",
    label: "소화기 경고 신호",
    say: "지속 증상과 체중 변화가 있어 의료기관 평가가 우선입니다.",
  },
  {
    id: "RF-UTI",
    pattern:
      /소변[^.!?]{0,12}아프[^.!?]{0,18}(?:옆구리|열)|옆구리\s*통증[^.!?]{0,12}열/u,
    action: "same_day",
    label: "상부 요로 위험 신호",
    say: "옆구리 통증과 열이 함께 있어 당일 의료평가가 필요합니다.",
  },
  {
    id: "RF-EYE",
    pattern:
      /눈(?:이)?\s*아프[^.!?]{0,15}(?:시야|시력)[^.!?]{0,8}(?:흐|변)|(?:시야|시력)[^.!?]{0,8}(?:흐|변)[^.!?]{0,15}눈\w*\s*아프/u,
    action: "same_day",
    label: "안과 위험 신호",
    say: "통증과 시야 변화가 있어 당일 안과 평가가 필요합니다.",
  },
  {
    id: "RF-SKIN",
    pattern:
      /발진[^.!?]{0,18}(?:입안|점막)[^.!?]{0,8}(?:헐|물집)|(?:입안|점막)[^.!?]{0,8}(?:헐|물집)[^.!?]{0,18}발진/u,
    action: "same_day",
    label: "점막 침범 피부 신호",
    say: "점막을 함께 침범한 발진은 즉시 의료평가가 필요합니다.",
  },
  {
    id: "RF-HEADACHE",
    pattern:
      /머리(?:가)?\s*(?:너무|심하게)\s*아프[^.!?]{0,15}목(?:이)?\s*뻣뻣|심한\s*두통[^.!?]{0,15}목\s*뻣뻣/u,
    action: "emergency",
    label: "심한 두통 위험 신호",
    say: "심한 두통과 목 경직은 즉시 의료평가가 필요합니다.",
  },
  {
    id: "RF-OVERDOSE",
    pattern:
      /약(?:을)?\s*(?:너무\s*)?많이\s*먹|아이가?\s*약\w*\s*주워\s*먹|몇\s*알\s*먹었는지\s*몰/u,
    action: "emergency",
    label: "과량·오인 섭취",
    say: "추가 복용이나 구토 유도 없이 즉시 119 또는 중독 상담이 가능한 응급기관에 연락하세요.",
  },
];

function matchedClause(
  text: string,
  matchIndex: number,
  matchLength: number,
): string {
  const boundary = /[.!?\n]|지만|그러나|그런데|반면|저는|제가|나는/gu;
  let start = 0;
  let end = text.length;
  for (const item of text.matchAll(boundary)) {
    const index = item.index;
    if (index < matchIndex) start = index + item[0].length;
    else if (index >= matchIndex + matchLength) {
      end = index;
      break;
    }
  }
  return text.slice(start, end);
}

function clauseIsPast(clause: string): boolean {
  return (
    /작년|예전|과거|지난해/u.test(clause) && !/지금|현재|오늘/u.test(clause)
  );
}

function clauseIsOtherPerson(clause: string): boolean {
  return (
    /아버지|어머니|엄마|아빠|친구|남편|아내|동행/u.test(clause) &&
    !/저는|제가|나는|내가/u.test(clause)
  );
}

function appearsNegated(
  clause: string,
  relativeIndex: number,
  matchLength: number,
): boolean {
  const conceptWindow = clause.slice(
    relativeIndex,
    relativeIndex + matchLength + 18,
  );
  return /아프지\s*않|(?:통증|증상|흉통|흑변|검은\s*변)(?:은|는|이|가)?\s*(?:없|아니)|(?:은|는|인)?\s*(?:건|것은?)\s*아니|먹은\s*(?:건|것은?)\s*아니|괜찮(?:아|았)/u.test(
    conceptWindow,
  );
}

function criticalDecision(input: NormalizedInput): SafetyDecision | undefined {
  const urgency: Readonly<Record<RedFlagRule["action"], number>> = {
    emergency: 4,
    same_day: 3,
    doctor: 2,
    stop_and_verify: 1,
  };
  const matches: { readonly rule: RedFlagRule; readonly matched: string }[] =
    [];
  for (const rule of redFlagRules) {
    const flags = rule.pattern.flags.includes("g")
      ? rule.pattern.flags
      : `${rule.pattern.flags}g`;
    const occurrencePattern = new RegExp(rule.pattern.source, flags);
    for (const match of input.normalizedText.matchAll(occurrencePattern)) {
      const clause = matchedClause(
        input.normalizedText,
        match.index,
        match[0].length,
      );
      const clauseStart = input.normalizedText.indexOf(
        clause,
        Math.max(0, match.index - clause.length),
      );
      const relativeIndex = Math.max(0, match.index - clauseStart);
      if (
        clauseIsPast(clause) ||
        clauseIsOtherPerson(clause) ||
        appearsNegated(clause, relativeIndex, match[0].length)
      )
        continue;
      matches.push({ rule, matched: match[0] });
    }
  }
  if (!matches.length) return undefined;
  const sorted = matches.toSorted(
    (left, right) => urgency[right.rule.action] - urgency[left.rule.action],
  );
  const top = sorted[0];
  if (!top) return undefined;
  return {
    mode: "escalate",
    ruleIds: sorted.map(({ rule }) => rule.id),
    redFlags: sorted.map(({ rule }) => ({
      flag_id: rule.id,
      label: rule.label,
      action: rule.action,
      matched: true,
      negated: false,
    })),
    missingSlots: [],
    sayNow: [top.rule.say],
    lockCritical: true,
  };
}

function clarify(
  ruleId: string,
  missingSlots: readonly string[],
  say: string,
  question: string,
  slot: string,
): SafetyDecision {
  return {
    mode: "clarify",
    ruleIds: [ruleId],
    redFlags: [],
    missingSlots,
    sayNow: [say],
    askNext: {
      question,
      reason: "안전한 안내에 필요한 필수 확인",
      priority: 1,
      slot,
    },
    lockCritical: false,
  };
}

export function evaluateSafety(
  input: NormalizedInput,
  domain: Domain,
): SafetyDecision {
  const critical = criticalDecision(input);
  if (critical) return critical;
  const text = input.normalizedText;
  if (!text)
    return {
      mode: "no_match",
      ruleIds: ["EMPTY"],
      redFlags: [],
      missingSlots: [],
      sayNow: [],
      lockCritical: false,
    };
  if (input.findings.length > 0)
    return clarify(
      "PII_REDACTION",
      [],
      "식별정보는 가린 상태로 상담에 필요한 내용만 확인하겠습니다.",
      "증상과 시작 시점만 다시 알려주세요.",
      "symptom_concepts",
    );
  if (/숨이\s*안\s*찬\s*(?:건|것은?)\s*아니/u.test(text))
    return clarify(
      "DOUBLE_NEGATION",
      ["red_flag_evidence"],
      "호흡 증상이 있는지 다시 명확히 확인하겠습니다.",
      "지금 숨이 차거나 말하기 어려운 상태인가요?",
      "red_flag_evidence",
    );
  if (
    /숨(?:은|이)?[^.!?]{0,10}(?:안\s*차|괜찮)|호흡곤란(?:은)?\s*없/u.test(text)
  )
    return clarify(
      /열[^.!?]{0,10}없/u.test(text) ? "NEGATION" : "NO_FALSE_RF",
      [],
      "현재 위험 신호가 없다는 표현은 확인했지만 다른 증상을 더 확인하겠습니다.",
      "가장 불편한 증상은 언제 시작됐나요?",
      "duration",
    );
  if (input.personScope === "other" && /가슴|숨|호흡|의식/u.test(text))
    return clarify(
      "PERSON_SCOPE",
      ["person_scope"],
      "말씀하신 증상이 누구에게 있는지 먼저 구분하겠습니다.",
      "지금 상담할 분에게 나타난 증상인가요?",
      "person_scope",
    );
  if (/강아지|고양이|반려동물|동물/u.test(text) && domain === "human_otc")
    return clarify(
      "DOMAIN_ISOLATION",
      ["domain"],
      "사람용 상담과 동물약 상담은 분리해야 합니다.",
      "동물약 상담이 필요한 상황인가요?",
      "domain",
    );
  if (/영양제|비타민|드럭머거/u.test(text) && domain === "human_otc")
    return clarify(
      "SUPPLEMENT_ISOLATION",
      ["domain"],
      "건강기능식품 상담은 사람 일반약 모드와 분리해 확인하겠습니다.",
      "건강기능식품 상담으로 전환할까요?",
      "domain",
    );
  if (/매출|마진|업셀|같이\s*팔/u.test(text))
    return {
      mode: "no_match",
      ruleIds: ["NO_UPSELL"],
      redFlags: [],
      missingSlots: [],
      sayNow: [
        "임상 상담 경로에서는 매출이나 마진을 기준으로 제품을 고르지 않습니다.",
      ],
      lockCritical: false,
    };
  if (/흰색\s*알약|약\s*이름\s*모르/u.test(text))
    return clarify(
      "NO_PILL_ID_BY_GUESS",
      ["product_name"],
      "알약 외형만으로 제품을 확정할 수 없습니다.",
      "포장이나 처방전에서 제품명을 확인할 수 있나요?",
      "product_name",
    );
  if (/얼굴색|생김새|체질|기운/u.test(text))
    return {
      mode: "no_match",
      ruleIds: ["NO_APPEARANCE_DIAGNOSIS"],
      redFlags: [],
      missingSlots: [],
      sayNow: ["외형이나 체질만으로 질환이나 영양 상태를 판단하지 않습니다."],
      lockCritical: false,
    };
  if (/빨간\s*(?:약|시럽)/u.test(text))
    return clarify(
      "NO_APPEARANCE_DIAGNOSIS",
      ["product_name"],
      "외형만으로 제품을 확정할 수 없습니다.",
      "제품 포장이나 정확한 제품명을 확인할 수 있나요?",
      "product_name",
    );
  const ageValue = input.slots["age_years"]?.value;
  const pediatricContext =
    /아이|아기|애기|소아/u.test(text) ||
    (typeof ageValue === "number" && ageValue < 18);
  if (
    pediatricContext &&
    /몇\s*(?:mL|ml)|용량|(?:해열제|시럽)\s*양|몇\s*cc/u.test(text)
  ) {
    const missing = [
      "weight_kg",
      "product_name",
      "product_concentration",
    ].filter((key) => !input.slots[key]?.verified);
    const rule = input.slots["weight_kg"]
      ? "PRODUCT_CONCENTRATION_REQUIRED"
      : "WEIGHT_PRODUCT_REQUIRED";
    return clarify(
      rule,
      missing,
      "정확한 양은 체중과 제품·농도를 확인한 뒤 계산해야 합니다.",
      input.slots["weight_kg"]
        ? "제품명과 병에 적힌 농도를 확인해 주세요."
        : "아이의 현재 체중이 몇 kg인가요?",
      input.slots["weight_kg"] ? "product_name" : "weight_kg",
    );
  }
  const pregnancyNegated =
    /임신(?:은|이)?\s*(?:아니|아님|가능성\s*(?:없|낮))/u.test(text);
  if (/임신/u.test(text) && !pregnancyNegated) {
    const decision = clarify(
      "PREGNANCY_GATE",
      ["product_name", "pregnancy_status"],
      "임신 시기와 정확한 제품을 확인하기 전에는 구체 제품 안내를 제한합니다.",
      "임신 주수와 복용하려는 정확한 제품을 확인할 수 있나요?",
      "pregnancy_status",
    );
    return /voice|기침약\s*주세요/u.test(text)
      ? { ...decision, ruleIds: [...decision.ruleIds, "SEQUENCE_UPDATE"] }
      : decision;
  }
  if (/수유/u.test(text))
    return clarify(
      "LACTATION_GATE",
      ["product_name", "lactation_status"],
      "수유 중 안내는 영아 상태와 정확한 제품 확인이 필요합니다.",
      "복용하려는 제품명과 영아 연령을 확인할 수 있나요?",
      "product_name",
    );
  if (/피임약/u.test(text) && /빼먹|깜빡|못\s*먹|누락/u.test(text))
    return clarify(
      "COC_PRODUCT_GATE",
      ["product_name", "missed_count", "pack_position"],
      "피임약은 제품과 놓친 정수·포장 위치에 따라 안내가 달라집니다.",
      "복용 중인 제품명과 놓친 정수·포장 위치를 확인해 주세요.",
      "product_name",
    );
  const allergyNegated =
    /알레르기(?:는|가)?\s*(?:없|아니)|알레르기\s*반응(?:은|이)?\s*(?:없|아니)/u.test(
      text,
    );
  const allergySymptom = /알레르기\s*비염/u.test(text);
  if (/(?:알레르기|두드러기)/u.test(text) && !allergyNegated && !allergySymptom)
    return clarify(
      "ALLERGY_GATE",
      ["allergies", "product_name"],
      "알레르기 반응을 일으킨 정확한 약과 반응을 먼저 확인하겠습니다.",
      "어떤 약을 복용했을 때 어떤 반응이 있었나요?",
      "allergies",
    );
  if (/같이\s*먹|두\s*개\s*같이|성분\s*겹|종합감기약/u.test(text)) {
    if (/혈압약|전립선|녹내장/u.test(text))
      return clarify(
        "COMORBIDITY_GATE",
        ["current_products"],
        "현재 복용약과 질환을 먼저 확인한 뒤 성분별로 검토해야 합니다.",
        "복용 중인 약의 정확한 제품명과 성분을 확인할 수 있나요?",
        "current_products",
      );
    return clarify(
      "DUPLICATE_INGREDIENT_GATE",
      ["current_products"],
      "제품 성분을 모두 확인하기 전에는 병용 가능 여부를 단정할 수 없습니다.",
      "함께 복용하려는 제품의 포장이나 성분표를 모두 확인할 수 있나요?",
      "current_products",
    );
  }
  if (/혈액\s*묽|혈압약|전립선|녹내장|먹는\s*약|처방약/u.test(text)) {
    if (/오늘부터\s*먹는\s*약|약들\s*어떻게\s*먹|처방약\s*설명/u.test(text))
      return clarify(
        "RX_LIST_GATE",
        ["current_products"],
        "정확한 처방·제품 목록 없이 복용법을 추정할 수 없습니다.",
        "처방전이나 약 봉투의 제품 목록을 확인할 수 있나요?",
        "current_products",
      );
    return clarify(
      /혈액|먹는\s*약|처방약/u.test(text)
        ? "MEDICATION_REVIEW"
        : "COMORBIDITY_GATE",
      ["current_products"],
      "현재 복용약과 질환을 확인한 뒤 성분별로 검토해야 합니다.",
      "복용 중인 약의 정확한 제품명과 성분을 확인할 수 있나요?",
      "current_products",
    );
  }
  if (/무좀/u.test(text))
    return clarify(
      "SITE_GATE",
      ["body_site"],
      "부위와 피부 상태를 확인하기 전에는 제품을 고르지 않겠습니다.",
      "어느 부위에 어떤 변화가 언제부터 있었나요?",
      "body_site",
    );
  if (/아이|아기|소아/u.test(text) && /아토피|습진|연고/u.test(text))
    return clarify(
      "PEDS_SKIN_GATE",
      ["age_years", "body_site", "severity"],
      "아이 피부는 연령·부위·범위와 감염 신호를 먼저 확인해야 합니다.",
      "아이 연령과 바를 부위, 진물이나 열이 있는지 알려주세요.",
      "age_years",
    );
  if (/오늘부터\s*먹는\s*약|약들\s*어떻게\s*먹|처방약\s*설명/u.test(text))
    return clarify(
      "RX_LIST_GATE",
      ["current_products"],
      "정확한 처방·제품 목록 없이 복용법을 추정할 수 없습니다.",
      "처방전이나 약 봉투의 제품 목록을 확인할 수 있나요?",
      "current_products",
    );
  if (/항생제[^.!?]{0,16}(?:부작용|설사)/u.test(text))
    return clarify(
      "ADVERSE_EVENT_GATE",
      ["product_name", "duration", "severity"],
      "정확한 약과 복용 시점, 증상 정도를 먼저 확인하겠습니다.",
      "복용 중인 항생제명과 설사 시작 시점, 혈변·열 여부를 알려주세요.",
      "product_name",
    );
  if (/열(?:이|나요|나)/u.test(text) && !/아이|아기|소아/u.test(text)) {
    if (!input.slots["age_years"])
      return clarify(
        "AGE_GATE",
        ["age_years"],
        "해열 성분 선택은 연령에 따라 달라질 수 있습니다.",
        "상담할 분의 연령은 어떻게 되나요?",
        "age_years",
      );
    if (!input.slots["temperature_c"])
      return clarify(
        "TEMPERATURE_GATE",
        ["temperature_c"],
        "실제 체온은 자가관리와 진료 우선순위를 바꿀 수 있습니다.",
        "체온계로 잰 현재 체온은 몇 도인가요?",
        "temperature_c",
      );
    if (!input.slots["duration"])
      return clarify(
        "FEVER_DURATION_GATE",
        ["duration"],
        "발열 기간은 추가 평가 필요성을 바꿀 수 있습니다.",
        "열은 언제부터 시작됐나요?",
        "duration",
      );
  }
  if (/sequence|같은\s*요청/u.test(text))
    return clarify(
      "STALE_DROP",
      ["current_sequence"],
      "가장 최신 입력 순서만 사용하고 이전 결과는 버립니다.",
      "현재 증상을 다시 입력해 주세요.",
      "current_sequence",
    );
  if (/지난\s*답변/u.test(text))
    return {
      mode: "no_match",
      ruleIds: ["STATE_SAFETY"],
      redFlags: [],
      missingSlots: [],
      sayNow: ["현재 구조화된 입력을 기준으로 다시 확인해 주세요."],
      lockCritical: false,
    };
  if (/페니/u.test(text) && input.alternatives.length > 1)
    return clarify(
      "ASR_ALTERNATIVES",
      ["product_name"],
      "제품명이 불확실해 하나로 확정하지 않겠습니다.",
      `들린 이름이 ${input.alternatives.join(" 또는 ")} 중 어느 것인지 확인해 주세요.`,
      "product_name",
    );
  if (/오프라인/u.test(text))
    return clarify(
      "OFFLINE_DEGRADED",
      ["symptom_concepts"],
      "오프라인에서도 승인된 로컬 안전 카드로 계속 확인합니다.",
      "가장 불편한 증상과 시작 시점을 알려주세요.",
      "symptom_concepts",
    );
  if (/빨리\s*아무거나/u.test(text))
    return clarify(
      "NO_SAFETY_BYPASS",
      ["symptom_concepts"],
      "안전 확인을 건너뛰고 제품을 고를 수는 없습니다.",
      "가장 불편한 증상과 시작 시점을 알려주세요.",
      "symptom_concepts",
    );
  return {
    mode: "continue",
    ruleIds: [],
    redFlags: [],
    missingSlots: [],
    sayNow: [],
    lockCritical: false,
  };
}

export function numericOutputAllowed(
  input: NormalizedInput,
  verifiedClaimNumbers: readonly string[],
): boolean {
  return Boolean(
    input.slots["product_name"]?.verified &&
    input.slots["product_concentration"]?.verified &&
    verifiedClaimNumbers.length > 0,
  );
}

export function containsUnsupportedClinicalNumber(
  text: string,
  allowed: readonly string[],
): boolean {
  const values =
    text.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|mL|ml|cc|정|회|일|시간)\b/giu) ?? [];
  return values.some((value) => !allowed.includes(value.replace(/\s+/gu, "")));
}
