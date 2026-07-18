import type {
  ClinicalClaim,
  DrugProduct,
  Ingredient,
  OTCProtocol,
  ProductIngredient,
  ProtocolOption,
  ProtocolRule,
  SourceSnapshot,
  TenantFormulary,
  TenantInventory,
  TenantSalesAggregate,
} from "@pharmassist/contracts";
import type { KnowledgeCard } from "@pharmassist/retrieval";

const expiresAt = "2099-12-31T23:59:59Z";
const verifiedAt = "2026-07-13T00:00:00Z";
const packId = "PACK-SYNTHETIC-DECISION-DEMO";
const sourceId = "SRC-SYNTHETIC-DECISION-DEMO";
const sourceSnapshotId = "SNAP-SYNTHETIC-DECISION-DEMO";

const review: Ingredient["review"] = {
  pharmacist_approved: true,
  official_source_verified: true,
  reviewer_ids: ["synthetic-fixture"],
  reviewed_at: verifiedAt,
  expires_at: expiresAt,
  notes: "TEST ONLY: synthetic fixture; production activation is prohibited.",
};

const single = <T>(value: T): [T] => [value];

const makeCard = (
  card: Omit<KnowledgeCard, "approved" | "synthetic" | "expiresAt" | "domain">,
): KnowledgeCard => ({
  ...card,
  domain: "human_otc",
  approved: true,
  synthetic: true,
  expiresAt,
});

/** Legacy cards remain available for current UI/topic matching and regression tests. */
export const syntheticCards: readonly KnowledgeCard[] = [
  makeCard({
    cardId: "CARD-SYN-COUGH",
    intent: "cough_general",
    title: "기침 확인",
    anchors: ["기침", "가래"],
    aliases: ["기침약", "기침약 주세요", "기침이 나요", "밤에 기침"],
    keywords: ["기침 기간 가래 호흡"],
    sayNow: ["먼저 호흡 곤란 같은 위험 신호와 기침 기간을 확인하겠습니다."],
    askNext: {
      question: "기침은 언제부터 시작됐나요?",
      reason: "지속 기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["증상만으로 원인을 확정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-NASAL",
    intent: "nasal_symptom_general",
    title: "콧물·코막힘 확인",
    anchors: ["콧물", "코막힘", "코가 막", "재채기"],
    aliases: ["콧물", "콧물약 주세요", "코가 막혀요", "재채기하고 콧물"],
    keywords: ["콧물 코막힘 재채기 기간"],
    sayNow: ["먼저 증상 기간과 호흡 관련 위험 신호를 확인하겠습니다."],
    askNext: {
      question: "콧물과 코막힘은 언제부터 시작됐나요?",
      reason: "기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["콧물 색만으로 원인을 단정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-THROAT",
    intent: "sore_throat",
    title: "인후통 확인",
    anchors: ["목", "인후", "삼키"],
    aliases: ["목이 따끔", "목이 아파요", "인후통약"],
    keywords: ["목 통증 삼킴 호흡 기간"],
    sayNow: ["먼저 삼키기 어렵거나 숨쉬기 힘든 신호가 있는지 확인하겠습니다."],
    askNext: {
      question: "목 통증은 언제부터 있었나요?",
      reason: "기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["검사 없이 질환을 확정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-DYSPEPSIA",
    intent: "dyspepsia_general",
    title: "속쓰림·소화 불편 확인",
    anchors: ["소화", "더부룩", "명치", "체했", "속쓰림"],
    aliases: ["속이 더부룩", "소화가 안 돼요", "속이 쓰려요", "체했어요"],
    keywords: ["속쓰림 더부룩 소화 명치 기간 통증"],
    sayNow: [
      "먼저 통증 위치와 지속 기간, 출혈 같은 위험 신호를 확인하겠습니다.",
    ],
    askNext: {
      question: "속쓰림과 더부룩함 중 어느 쪽이 더 불편한가요?",
      reason: "선택을 바꾸는 증상 양상 확인",
      priority: 1,
      slot: "dyspepsia_pattern",
    },
    avoid: ["복통 원인을 임의로 진단하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-ABDOMINAL",
    intent: "abdominal_pain_general",
    title: "복통 위치 확인",
    anchors: ["배", "복통", "아랫배", "윗배"],
    aliases: ["배가 아파요", "복통이 있어요"],
    keywords: ["배 복통 위치 압통 구토 출혈"],
    sayNow: ["복통은 위치와 위험 신호를 먼저 구분하겠습니다."],
    askNext: {
      question: "윗배·아랫배 중 어디가 가장 불편한가요?",
      reason: "복통 위치 확인",
      priority: 1,
      slot: "body_site",
    },
    avoid: ["복통은 합성 fixture에서 성분·제품 추천으로 연결하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-BOWEL-URGENCY",
    intent: "bowel_urgency_general",
    title: "설사·변비 확인",
    anchors: ["대변", "배변", "설사", "변비", "똥"],
    aliases: [
      "설사해요",
      "묽은 변",
      "변이 안 나와요",
      "변비예요",
      "똥이 마려워요",
    ],
    keywords: ["설사 변비 묽은변 횟수 기간"],
    sayNow: ["장 증상 유형을 한 번만 구분하겠습니다."],
    askNext: {
      question: "묽은 변이 나오는 쪽인가요, 변이 잘 안 나오는 쪽인가요?",
      reason: "설사와 변비 선택 분기",
      priority: 1,
      slot: "stool_pattern",
    },
    avoid: ["배변감만으로 설사나 변비를 단정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-MUSCULOSKELETAL",
    intent: "musculoskeletal_pain",
    title: "근육·관절 통증 확인",
    anchors: ["어깨", "허리", "무릎", "관절", "근육", "근육통"],
    aliases: ["근육통이 있어요", "어깨가 아파요", "허리가 아파요"],
    keywords: ["근육 관절 통증 부상 움직임 부종"],
    sayNow: ["근육·관절 통증의 양상을 빠르게 확인하겠습니다."],
    askNext: {
      question: "다치거나 붓고 뜨거운 증상이 있나요?",
      reason: "제품 추천보다 평가가 우선인 상황 확인",
      priority: 1,
      slot: "injury_inflammation",
    },
    avoid: ["통증 부위만으로 원인을 확정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-SKIN",
    intent: "skin_general",
    title: "피부 증상 확인",
    anchors: ["피부", "가려", "습진", "발진"],
    aliases: ["피부가 가려워요", "피부가 건조해요", "발진이 있어요"],
    keywords: ["피부 부위 범위 점막 진물 통증"],
    sayNow: ["먼저 부위와 범위, 점막·진물·통증 여부를 확인하겠습니다."],
    askNext: {
      question: "진물이나 심한 통증, 눈·입 주변 증상이 있나요?",
      reason: "국소 제품 추천 제외 상황 확인",
      priority: 1,
      slot: "skin_alarm",
    },
    avoid: ["사진이나 진찰 없이 피부질환을 확정하지 않습니다."],
  }),
  makeCard({
    cardId: "CARD-SYN-FEVER",
    intent: "fever_general",
    title: "발열 확인",
    anchors: ["열", "발열", "몸살", "체온"],
    aliases: ["열나요", "열이 나요", "몸살에 열"],
    keywords: ["발열 연령 측정 체온 기간"],
    sayNow: ["연령과 측정한 체온, 시작 시점을 먼저 확인하겠습니다."],
    askNext: {
      question: "연령과 실제로 잰 체온은 어떻게 되나요?",
      reason: "발열 상담의 필수 확인",
      priority: 1,
      slot: "age_temperature",
    },
    avoid: ["연령과 제품 확인 없이 용량을 말하지 않습니다."],
  }),
];

export const syntheticSources: readonly SourceSnapshot[] = [
  {
    source_snapshot_id: sourceSnapshotId,
    source_id: sourceId,
    provider: "other",
    official: false,
    source_url: "https://example.invalid/pharmassist-synthetic-fixture",
    fetched_at: verifiedAt,
    effective_at: verifiedAt,
    terms_url: null,
    usage_rights: "unrestricted",
    commercial_use: "allowed",
    cache_policy: "allowed",
    redistribution: "allowed",
    ai_context_use: "allowed",
    http_status: 200,
    content_sha256: "0".repeat(64),
    content_type: "application/json",
    parser_version: "synthetic-2",
    record_count: 10,
    page_count: 1,
    next_cursor: null,
    status: "parsed",
    raw_retention_policy: "none",
    uncertainty:
      "Synthetic test fixture. It is not an official or clinical source.",
  },
];

interface FixtureDefinition {
  readonly key: string;
  readonly intent: string;
  readonly category: string;
  readonly label: string;
  readonly ingredientName: string;
  readonly anchors: readonly string[];
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly requiredSlot?: string;
  readonly question?: string;
  readonly questionReason?: string;
}

const definitions: readonly FixtureDefinition[] = [
  {
    key: "COUGH",
    intent: "cough_general",
    category: "cough",
    label: "기침",
    ingredientName: "검토용 기침 성분 A",
    anchors: ["기침", "가래"],
    aliases: ["기침약", "기침이 나요"],
    keywords: ["기침", "가래", "기간"],
    requiredSlot: "duration",
    question: "기침은 언제부터 시작됐나요?",
    questionReason: "기간에 따라 자가관리와 추가 평가가 달라질 수 있습니다.",
  },
  {
    key: "NASAL",
    intent: "nasal_symptom_general",
    category: "nasal",
    label: "콧물",
    ingredientName: "검토용 비강 성분 A",
    anchors: ["콧물", "코막힘", "재채기"],
    aliases: ["콧물약", "코가 막혀요"],
    keywords: ["콧물", "코막힘", "재채기"],
    requiredSlot: "duration",
    question: "콧물이나 코막힘은 언제부터 시작됐나요?",
    questionReason:
      "증상 기간은 제품 선택과 추가 평가 여부를 바꿀 수 있습니다.",
  },
  {
    key: "THROAT",
    intent: "sore_throat",
    category: "sore_throat",
    label: "인후통",
    ingredientName: "검토용 인후 성분 A",
    anchors: ["목", "인후", "삼키"],
    aliases: ["목이 아파요", "인후통"],
    keywords: ["목", "통증", "삼킴"],
    requiredSlot: "duration",
    question: "목 통증은 언제부터 시작됐나요?",
    questionReason: "기간은 자가관리와 진료 우선순위를 바꿀 수 있습니다.",
  },
  {
    key: "HEARTBURN",
    intent: "dyspepsia_general",
    category: "heartburn",
    label: "속쓰림",
    ingredientName: "검토용 속쓰림 성분 A",
    anchors: ["속쓰림", "속이 쓰"],
    aliases: ["속이 쓰려요"],
    keywords: ["속쓰림", "명치"],
  },
  {
    key: "DYSPEPSIA",
    intent: "dyspepsia_general",
    category: "dyspepsia",
    label: "소화불량",
    ingredientName: "검토용 소화 성분 A",
    anchors: ["소화", "더부룩", "체했"],
    aliases: ["소화가 안 돼요", "더부룩해요"],
    keywords: ["소화", "더부룩"],
    requiredSlot: "dyspepsia_pattern",
    question: "속쓰림과 더부룩함 중 어느 쪽이 더 불편한가요?",
    questionReason: "두 양상은 검토할 성분 후보를 바꿉니다.",
  },
  {
    key: "DIARRHEA",
    intent: "bowel_urgency_general",
    category: "diarrhea",
    label: "설사",
    ingredientName: "검토용 설사 성분 A",
    anchors: ["설사", "묽은 변"],
    aliases: ["설사해요"],
    keywords: ["설사", "묽은변"],
  },
  {
    key: "CONSTIPATION",
    intent: "bowel_urgency_general",
    category: "constipation",
    label: "변비",
    ingredientName: "검토용 변비 성분 A",
    anchors: ["변비", "변이 안"],
    aliases: ["변비예요"],
    keywords: ["변비", "딱딱"],
  },
  {
    key: "MUSCLE",
    intent: "musculoskeletal_pain",
    category: "musculoskeletal",
    label: "근육통",
    ingredientName: "검토용 근육통 성분 A",
    anchors: ["근육통", "어깨", "허리"],
    aliases: ["근육이 아파요"],
    keywords: ["근육", "통증"],
    requiredSlot: "injury_inflammation",
    question: "다치거나 붓고 뜨거운 증상이 있나요?",
    questionReason: "부상·염증 신호는 제품 추천보다 평가를 우선하게 합니다.",
  },
  {
    key: "SKIN",
    intent: "skin_general",
    category: "skin",
    label: "피부 증상",
    ingredientName: "검토용 피부 성분 A",
    anchors: ["피부", "가려", "건조"],
    aliases: ["피부가 가려워요"],
    keywords: ["피부", "가려움"],
    requiredSlot: "skin_alarm",
    question: "진물이나 심한 통증, 눈·입 주변 증상이 있나요?",
    questionReason: "점막·진물·통증은 국소 제품 추천을 중단하게 합니다.",
  },
  {
    key: "FEVER",
    intent: "fever_general",
    category: "fever",
    label: "발열",
    ingredientName: "검토용 발열 성분 A",
    anchors: ["열", "발열", "체온"],
    aliases: ["열이 나요"],
    keywords: ["발열", "체온"],
  },
];

const sourceRef = (claimId: string) => ({
  claim_id: claimId,
  source_id: sourceId,
  source_snapshot_id: sourceSnapshotId,
  locator: `synthetic://${claimId}`,
  verified_at: verifiedAt,
});

export const syntheticIngredients: readonly Ingredient[] = definitions.map(
  (item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      ingredient_id: `ING-SYN-${item.key}`,
      display_name_ko: item.ingredientName,
      display_name_en: null,
      normalized_name: item.ingredientName.replaceAll(" ", ""),
      mfds_ingredient_code: null,
      status: "active",
      source_snapshot_ids: single(sourceSnapshotId),
      source_refs: single(sourceRef(claimId)),
      review,
    };
  },
);

export const syntheticProducts: readonly DrugProduct[] = definitions.map(
  (item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      product_id: `PRD-SYN-${item.key}`,
      display_name: `검토용 ${item.label} 제품 A`,
      manufacturer: "Synthetic Fixture",
      jurisdiction: "KR",
      item_seq: `SYN-${item.key}`,
      permit_number: null,
      product_code: null,
      otc_status: "otc",
      dosage_form: null,
      route: null,
      permit_status: "synthetic",
      supply_performance: true,
      active_ingredients: [
        {
          ingredient_id: `ING-SYN-${item.key}`,
          name: item.ingredientName,
          strength_text: "synthetic-test-only",
          normalized_amount: null,
          normalized_unit: null,
        },
      ],
      status: "active",
      source_snapshot_ids: single(sourceSnapshotId),
      source_refs: single(sourceRef(claimId)),
      dur_flags: [],
    };
  },
);

export const syntheticProductIngredients: readonly ProductIngredient[] =
  definitions.map((item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      product_ingredient_id: `PRI-SYN-${item.key}`,
      product_id: `PRD-SYN-${item.key}`,
      ingredient_id: `ING-SYN-${item.key}`,
      strength_text: "synthetic-test-only",
      normalized_amount: null,
      normalized_unit: null,
      role: "active",
      is_active: true,
      source_refs: single(sourceRef(claimId)),
    };
  });

export const syntheticClaims: readonly ClinicalClaim[] = definitions.map(
  (item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      claim_id: claimId,
      pack_id: packId,
      claim_type: "indication",
      subject_type: "ingredient",
      subject_id: `ING-SYN-${item.key}`,
      predicate: "synthetic_fixture_candidate_for",
      object: {
        symptom_category: item.category,
        ingredient_id: `ING-SYN-${item.key}`,
        candidate_product_ids: [`PRD-SYN-${item.key}`],
      },
      qualifiers: { synthetic: true, clinical_use_prohibited: true },
      status: "published",
      risk_level: "low",
      source_refs: single(sourceRef(claimId)),
      conflict_claim_ids: [],
      review,
    };
  },
);

const selectRuleId = (key: string): string => `RUL-SYN-${key}-SELECT`;
const askRuleId = (key: string): string => `RUL-SYN-${key}-ASK`;

export const syntheticProtocols: readonly OTCProtocol[] = definitions.map(
  (item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      protocol_id: `PTC-SYN-${item.key}`,
      pack_id: packId,
      version: "1.0.0",
      domain: "human_otc",
      intent: item.intent,
      symptom_category: item.category,
      display_name: `검토용 ${item.label} 프로토콜`,
      status: "published",
      triggers: {
        anchors: [...item.anchors],
        aliases: [...item.aliases],
        keywords: [...item.keywords],
        negative: [],
      },
      option_ids: single(`OPT-SYN-${item.key}`),
      rule_ids: [
        ...(item.requiredSlot ? [askRuleId(item.key)] : []),
        selectRuleId(item.key),
      ],
      source_refs: single(sourceRef(claimId)),
      review,
      expires_at: expiresAt,
    };
  },
);

export const syntheticProtocolOptions: readonly ProtocolOption[] =
  definitions.map((item) => {
    const claimId = `CLM-SYN-${item.key}`;
    return {
      option_id: `OPT-SYN-${item.key}`,
      protocol_id: `PTC-SYN-${item.key}`,
      ingredient_id: `ING-SYN-${item.key}`,
      display_name: item.ingredientName,
      clinical_priority: 80,
      safety_priority: 80,
      therapeutic_role: "preferred",
      evidence_scope: "direct",
      fit_rationale: "Synthetic fixture with direct protocol fit",
      claim_ids: single(claimId),
      eligibility_rule_ids: item.requiredSlot ? [askRuleId(item.key)] : [],
      exclusion_rule_ids: [],
      source_refs: single(sourceRef(claimId)),
      status: "published",
      review,
    };
  });

export const syntheticProtocolRules: readonly ProtocolRule[] =
  definitions.flatMap((item) => {
    const claimId = `CLM-SYN-${item.key}`;
    const shared = {
      protocol_id: `PTC-SYN-${item.key}`,
      source_refs: single(sourceRef(claimId)),
      status: "published" as const,
      review,
    };
    const select: ProtocolRule = {
      ...shared,
      rule_id: selectRuleId(item.key),
      kind: "selection_pattern",
      operator: "matches",
      field: "normalized_text",
      value: item.anchors.join("|"),
      effect: "select",
      question: null,
      reason: "Synthetic fixture intent branch",
      priority: 20,
      option_ids: [`OPT-SYN-${item.key}`],
    };
    if (!item.requiredSlot) return [select];
    const ask: ProtocolRule = {
      ...shared,
      rule_id: askRuleId(item.key),
      kind: "required_slot",
      operator: "present",
      field: `slot.${item.requiredSlot}`,
      effect: "ask",
      question: item.question ?? "선택에 필요한 정보를 한 가지 알려주세요.",
      reason: item.questionReason ?? "선택을 바꾸는 정보 확인",
      priority: 10,
      option_ids: [`OPT-SYN-${item.key}`],
    };
    return [ask, select];
  });

export const syntheticFormulary: TenantFormulary = {
  formulary_id: "FRM-SYN-DEMO",
  tenant_id: "demo",
  pack_id: packId,
  version: "1",
  status: "active",
  coverage_target: 0.85,
  effective_from: verifiedAt,
  entries: definitions.map((item) => ({
    product_id: `PRD-SYN-${item.key}`,
    ingredient_id: `ING-SYN-${item.key}`,
    symptom_category: item.category,
    active: true,
    pharmacist_approved: true,
    preferred: true,
    notes: "Synthetic test entry",
  })),
  review,
};

export const syntheticInventory: readonly TenantInventory[] = definitions.map(
  (item, index) => ({
    inventory_id: `INV-SYN-${item.key}`,
    tenant_id: "demo",
    pack_id: packId,
    product_id: `PRD-SYN-${item.key}`,
    available_quantity: 20 - index,
    status: "in_stock",
    active: true,
    discontinued: false,
    observed_at: verifiedAt,
    source_snapshot_id: sourceSnapshotId,
  }),
);

export const syntheticSales: readonly TenantSalesAggregate[] = definitions.map(
  (item, index) => ({
    tenant_id: "demo",
    pack_id: packId,
    product_id: `PRD-SYN-${item.key}`,
    window_start: "2026-04-15",
    window_end: "2026-07-13",
    units_sold: 100 - index * 3,
    sales_rank: index + 1,
    cumulative_coverage: Math.min(0.9, 0.2 + index * 0.07),
    symptom_category: item.category,
    source_snapshot_id: sourceSnapshotId,
  }),
);

export const syntheticPack = {
  packId,
  version: "0.2.0-synthetic-decision-dev",
  domain: "human_otc" as const,
  synthetic: true,
  clinicalUseProhibited: true,
  verified: false,
  createdAt: verifiedAt,
  expiresAt,
  sources: syntheticSources,
  ingredients: syntheticIngredients,
  products: syntheticProducts,
  productIngredients: syntheticProductIngredients,
  claims: syntheticClaims,
  protocols: syntheticProtocols,
  protocolOptions: syntheticProtocolOptions,
  protocolRules: syntheticProtocolRules,
  cards: syntheticCards,
};
