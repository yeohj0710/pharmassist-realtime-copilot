import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(
  /^\/(?:([A-Za-z]:))/u,
  "$1",
);
const source = join(root, "data", "actual-candidate-source");
const output = join(root, "data", "actual-candidate-pack", "pack.json");
const seedSource = join(root, "spec", "knowledge_seed");
const dialogueReportOutput = join(
  root,
  "data",
  "actual-candidate-pack",
  "dialogue-seed-report.json",
);
const enrichmentOutput = join(
  root,
  "data",
  "actual-candidate-pack",
  "product-enrichment.json",
);
const productImageOutput = join(
  root,
  "apps",
  "web",
  "public",
  "product-images",
);
const selectionOverlaySource = join(
  root,
  "data",
  "actual-research-overlays",
  "option-selection.json",
);
const selectionCopySource = join(
  root,
  "data",
  "actual-research-overlays",
  "selection-copy.json",
);
const generatedSelectionOverlaySource = join(
  root,
  "data",
  "actual-research-overlays",
  "option-selection-generated.json",
);
const triggerSupplementSource = join(
  root,
  "data",
  "actual-research-overlays",
  "protocol-trigger-supplements.json",
);
const dialogueCopySource = join(
  root,
  "data",
  "actual-research-overlays",
  "dialogue-copy.json",
);
const therapeuticFitSource = join(
  root,
  "data",
  "actual-research-overlays",
  "therapeutic-fit.json",
);
const productMediaOverlaySource = join(
  root,
  "data",
  "actual-research-overlays",
  "product-media.json",
);
const healthKrRegistrySource = join(
  root,
  "data",
  "healthkr-product-registry",
  "registry.json",
);
const healthKrRegistryManifestSource = join(
  root,
  "data",
  "healthkr-product-registry",
  "manifest.json",
);
const healthKrProductCrosswalkSource = join(
  root,
  "data",
  "actual-research-overlays",
  "healthkr-product-crosswalk.json",
);
const clinicalPathwayMappingSource = join(
  root,
  "data",
  "clinical-pathways",
  "product-mappings.json",
);
const clinicalPathwayDefinitionSource = join(
  root,
  "data",
  "clinical-pathways",
  "pathways.json",
);
const fieldPracticeGuidanceSource = join(
  root,
  "data",
  "clinical-pathways",
  "field-practice-guidance.json",
);
const fieldPracticeProtocolsSource = join(
  root,
  "data",
  "clinical-pathways",
  "field-practice-protocols.json",
);
const fieldPracticeGuidanceReportOutput = join(
  root,
  "data",
  "actual-candidate-pack",
  "field-practice-guidance-report.json",
);
const healthKrLegacyMatchReportOutput = join(
  root,
  "data",
  "actual-candidate-pack",
  "healthkr-legacy-match-report.json",
);
const mfdsIndicationCandidateSource = join(
  root,
  "data",
  "actual-candidate-pack",
  "mfds-indication-candidates.json",
);
const mfdsIngredientCandidateSource = join(
  root,
  "data",
  "actual-candidate-pack",
  "mfds-ingredient-candidates.json",
);
const productMediaImageSource = join(
  root,
  "data",
  "actual-research-overlays",
  "product-images",
);

const readJsonl = async (name) =>
  (await readFile(join(source, name), "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const readOptionalJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [rawHeaders, ...values] = rows;
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/u, ""));
  return values.map((items) =>
    Object.fromEntries(
      headers.map((header, index) => [header, items[index] ?? ""]),
    ),
  );
};

const readCsv = async (name) =>
  parseCsv(await readFile(join(seedSource, name), "utf8"));

const intentProtocolMap = {
  nasal_symptom_general: "PTC-RUNNY_NOSE",
  rhinitis_vs_cold: "PTC-ALLERGIC_RHINITIS",
  discolored_nasal_discharge: "PTC-RUNNY_NOSE",
  cough_general: "PTC-DRY_COUGH",
  cough_not_improving: "PTC-DRY_COUGH",
  sore_throat: "PTC-SORE_THROAT",
  adult_fever: "PTC-FEVER",
  dyspepsia_general: "PTC-INDIGESTION",
  indigestion_fullness: "PTC-BLOATING",
  digestive_medicine_not_working: "PTC-INDIGESTION",
  heartburn_reflux_symptom: "PTC-HEARTBURN",
  nausea_vomiting_adult: "PTC-ABDOMINAL_PAIN_VOMITING",
  diarrhea_adult: "PTC-DIARRHEA",
  suspected_gastroenteritis: "PTC-DIARRHEA",
  constipation: "PTC-CONSTIPATION",
  abdominal_pain_unknown: "PTC-ABDOMINAL_PAIN_VOMITING",
  headache: "PTC-HEADACHE",
  musculoskeletal_pain: "PTC-MUSCLE_PAIN",
  pain_fever_product_selection: "PTC-HEADACHE",
  dysmenorrhea: "PTC-MENSTRUAL_PAIN",
  pediatric_fever: "PTC-FEVER",
  pediatric_vomiting_diarrhea: "PTC-DIARRHEA",
  pediatric_cold_cough: "PTC-DRY_COUGH",
  allergy_eczema: "PTC-MILD_DERMATITIS",
  pediatric_atopic_skin: "PTC-MILD_DERMATITIS",
  wound_burn: "PTC-MINOR_WOUND",
  insect_bite: "PTC-INSECT_BITE",
  nasal_spray_use: "PTC-NASAL_CONGESTION",
  eye_drop_use: "PTC-DRY_EYE",
  tinea_foot: "PTC-ANTIFUNGAL_SKIN",
  acne: "PTC-ACNE",
  hemorrhoid_symptom: "PTC-HEMORRHOID",
  vaginal_symptom: "PTC-VAGINAL_ANTIFUNGAL",
  menstrual_delay_request: "PTC-ORAL_CONTRACEPTION",
};

const dialogueFor = (intent, dialogueCopies) => {
  const title = intent.display_title;
  const override = dialogueCopies[intent.intent_id];
  if (override)
    return {
      sayNow: override.say_now,
      question: override.question,
      slot: override.slot,
    };
  if (intent.category === "respiratory")
    return {
      sayNow: `${title} 쪽으로 볼게요.`,
      question: "지금 가장 불편한 게 콧물·코막힘·목·기침 중 어느 쪽인가요?",
      slot: "symptom_pattern",
    };
  if (intent.category === "gastrointestinal")
    return {
      sayNow: `${title} 쪽으로 볼게요.`,
      question: "어디가 어떻게 불편한지, 언제부터 그랬는지만 말씀해 주세요.",
      slot: "symptom_pattern",
    };
  if (intent.category === "pain")
    return {
      sayNow: `${title}로 확인해 볼게요.`,
      question: "어디가 얼마나 아프고 언제부터 그랬나요?",
      slot: "pain_pattern",
    };
  if (intent.category === "pediatrics")
    return {
      sayNow: `${title}로 확인해 볼게요.`,
      question: "아이 나이와 체중, 지금 가장 불편한 증상을 말씀해 주세요.",
      slot: "patient.age_weight_symptom",
    };
  if (intent.category === "womens_health")
    return {
      sayNow: `${title}로 확인해 볼게요.`,
      question: "현재 증상과 복용 중인 제품이 있으면 제품명부터 말씀해 주세요.",
      slot: "patient.symptom_product",
    };
  if (intent.category === "dermatology")
    return {
      sayNow: `${title}로 확인해 볼게요.`,
      question: "어느 부위에 언제부터 생겼고, 번지거나 진물이 나나요?",
      slot: "patient.skin_pattern",
    };
  if (intent.category === "administration" || intent.category === "rx")
    return {
      sayNow: `${title}를 확인해 드릴게요.`,
      question: "제품명과 처방·포장에 적힌 복용법을 말씀해 주세요.",
      slot: "patient.product_instruction",
    };
  if (intent.category === "supplement")
    return {
      sayNow: `${title}를 확인해 드릴게요.`,
      question: "제품명과 함께 드시는 약이 있는지 말씀해 주세요.",
      slot: "patient.product_medications",
    };
  return {
    sayNow: `${title}로 확인해 볼게요.`,
    question: "지금 확인하고 싶은 내용을 조금만 더 말씀해 주세요.",
    slot: "patient.detail",
  };
};

const previewReview = (review) => ({
  ...review,
  pharmacist_approved: false,
  reviewer_ids: [],
  reviewed_at: null,
  notes:
    `${review.notes ?? ""} Local research preview activation only; production approval remains pending.`.trim(),
});

const [
  sources,
  ingredients,
  products,
  productIngredients,
  claims,
  protocols,
  protocolOptions,
  protocolRules,
  productEnrichment,
  intentSeeds,
  aliasSeeds,
  selectionOverlays,
  selectionCopy,
  triggerSupplements,
  dialogueCopies,
  therapeuticFit,
  productMediaOverlays,
  healthKrRegistryBody,
  healthKrRegistryManifest,
  healthKrProductCrosswalk,
  clinicalPathwayMappings,
  clinicalPathwayDefinitions,
  fieldPracticeGuidance,
  fieldPracticeProtocols,
] = await Promise.all([
  readJsonl("source_snapshots.jsonl"),
  readJsonl("ingredients.jsonl"),
  readJsonl("drug_products.jsonl"),
  readJsonl("product_ingredients.jsonl"),
  readJsonl("clinical_claims.jsonl"),
  readJsonl("otc_protocols.jsonl"),
  readJsonl("protocol_options.jsonl"),
  readJsonl("protocol_rules.jsonl"),
  readJsonl("product-enrichment/product_enrichment.jsonl"),
  readCsv("INTENT_INVENTORY_CANDIDATE.csv"),
  readCsv("ALIAS_SEED_CANDIDATE.csv"),
  // Hand-curated overlays plus the ones derived from each product's own
  // choose_when. Without the derived set most protocols expose a single
  // selectable option and most of their products can never be recommended.
  Promise.all([
    readFile(selectionOverlaySource, "utf8").then(JSON.parse),
    readFile(generatedSelectionOverlaySource, "utf8")
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      }),
  ]).then(([curated, generated]) => [...curated, ...generated]),
  readFile(selectionCopySource, "utf8").then(JSON.parse),
  readFile(triggerSupplementSource, "utf8").then(JSON.parse),
  readFile(dialogueCopySource, "utf8").then(JSON.parse),
  readFile(therapeuticFitSource, "utf8").then(JSON.parse),
  readFile(productMediaOverlaySource, "utf8").then(JSON.parse),
  readFile(healthKrRegistrySource, "utf8"),
  readFile(healthKrRegistryManifestSource, "utf8").then(JSON.parse),
  readFile(healthKrProductCrosswalkSource, "utf8").then(JSON.parse),
  readFile(clinicalPathwayMappingSource, "utf8").then(JSON.parse),
  readFile(clinicalPathwayDefinitionSource, "utf8").then(JSON.parse),
  readFile(fieldPracticeGuidanceSource, "utf8").then(JSON.parse),
  readFile(fieldPracticeProtocolsSource, "utf8").then(JSON.parse),
]);

const mfdsIndicationCandidates = await readOptionalJson(
  mfdsIndicationCandidateSource,
  { schemaVersion: "1.0.0", candidateOnly: true, entries: [], sources: [] },
);
const mfdsIngredientCandidates = await readOptionalJson(
  mfdsIngredientCandidateSource,
  { schemaVersion: "1.0.0", candidateOnly: true, entries: [], sources: [] },
);
const mfdsIngredientSources = [
  ...(mfdsIndicationCandidates.sources ?? []),
  ...(mfdsIngredientCandidates.sources ?? []),
];
if (
  mfdsIndicationCandidates.candidateOnly !== true ||
  !Array.isArray(mfdsIndicationCandidates.entries) ||
  mfdsIngredientCandidates.candidateOnly !== true ||
  !Array.isArray(mfdsIngredientCandidates.entries)
)
  throw new Error("MFDS derived candidate files are invalid");
const mfdsRegisteredIngredients = mfdsIngredientCandidates.entries;
const mfdsSourceIds = new Set(
  mfdsIngredientSources.map((source) => source.source_snapshot_id),
);
for (const candidate of mfdsRegisteredIngredients) {
  if (
    candidate.candidateOnly !== true ||
    candidate.clinicalUseProhibited !== true ||
    !Array.isArray(candidate.source_snapshot_ids) ||
    candidate.source_snapshot_ids.length === 0 ||
    candidate.source_snapshot_ids.some((id) => !mfdsSourceIds.has(id)) ||
    !Array.isArray(candidate.source_refs) ||
    candidate.source_refs.length === 0
  )
    throw new Error(
      `MFDS ingredient candidate provenance failed: ${candidate.ingredient_id ?? "unknown"}`,
    );
}
const mfdsPackIngredients = mfdsRegisteredIngredients.map((item) =>
  Object.fromEntries(
    Object.entries(item).filter(
      ([key]) =>
        !["candidateOnly", "clinicalUseProhibited", "source_names"].includes(
          key,
        ),
    ),
  ),
);
const mfdsIndicationByItemSeq = new Map(
  mfdsIndicationCandidates.entries.map((entry) => [
    String(entry.itemSeq),
    entry,
  ]),
);

const healthKrRegistry = JSON.parse(healthKrRegistryBody);
const healthKrRegistryContentSha256 = createHash("sha256")
  .update(healthKrRegistryBody.replace(/\r\n/gu, "\n"))
  .digest("hex");
const clinicalPathwayByRegistryRecordId = new Map(
  clinicalPathwayMappings.records.map((item) => [item.registryRecordId, item]),
);
const clinicalPathwayByProtocolId = new Map(
  clinicalPathwayDefinitions.pathways.map((pathway) => [
    pathway.protocolId,
    pathway,
  ]),
);
const directProtocolIdsByItemSeq = new Map();
for (const record of healthKrRegistry.records) {
  const mapping = clinicalPathwayByRegistryRecordId.get(
    record.registryRecordId,
  );
  const itemSeq = record.officialProduct?.itemSeq;
  if (!itemSeq || mapping?.mappingStatus !== "direct") continue;
  directProtocolIdsByItemSeq.set(
    itemSeq,
    new Set(mapping.pathways.map((pathway) => pathway.protocolId)),
  );
}
if (
  clinicalPathwayMappings.schemaVersion !== "1.0.0" ||
  clinicalPathwayMappings.records.length !== healthKrRegistry.records.length
)
  throw new Error("Clinical pathway mappings are missing or inconsistent");
if (
  fieldPracticeGuidance.schemaVersion !== "1.0.0" ||
  fieldPracticeGuidance.researchOnly !== true ||
  !Array.isArray(fieldPracticeGuidance.profiles) ||
  !Array.isArray(fieldPracticeGuidance.legacyProtocolAllowlist) ||
  !Array.isArray(fieldPracticeGuidance.protocolDenylist) ||
  fieldPracticeGuidance.source?.contentSha256 !==
    "779e353077ad73871c97ce2cf7656a2b067c848a14d7abbf485d76992c36d9df"
)
  throw new Error("Field-practice guidance is missing or inconsistent");
const fieldPracticeRuleIds = new Set();
for (const rule of fieldPracticeGuidance.profiles) {
  if (
    typeof rule.ruleId !== "string" ||
    fieldPracticeRuleIds.has(rule.ruleId) ||
    !Array.isArray(rule.protocolIds) ||
    rule.protocolIds.length === 0 ||
    !rule.protocolIds.every((protocolId) =>
      clinicalPathwayByProtocolId.has(protocolId),
    ) ||
    !Array.isArray(rule.productNameAny) ||
    rule.productNameAny.length === 0 ||
    typeof rule.chooseWhen !== "string" ||
    !Array.isArray(rule.differentiators) ||
    rule.differentiators.length < 2 ||
    typeof rule.comparisonNote !== "string" ||
    !Array.isArray(rule.practicalPoints) ||
    !Number.isInteger(rule.page) ||
    rule.page < 1 ||
    rule.page > fieldPracticeGuidance.source.pageCount
  )
    throw new Error(`Invalid field-practice rule: ${rule.ruleId ?? "unknown"}`);
  // One profile can serve several protocols, and those protocols do not offer
  // the same candidates. A note naming famotidine is right under PTC-HEARTBURN
  // and dangling under PTC-ACID_REFLUX, which carries no famotidine at all.
  // byProtocol lets the shared profile say something different where the roster
  // differs, instead of forcing one sentence to be true everywhere.
  for (const [protocolId, override] of Object.entries(rule.byProtocol ?? {})) {
    if (!rule.protocolIds.includes(protocolId))
      throw new Error(
        `Field-practice override targets a protocol the rule does not serve: ${rule.ruleId} ${protocolId}`,
      );
    if (
      (override.chooseWhen !== undefined &&
        typeof override.chooseWhen !== "string") ||
      (override.comparisonNote !== undefined &&
        typeof override.comparisonNote !== "string") ||
      (override.differentiators !== undefined &&
        (!Array.isArray(override.differentiators) ||
          override.differentiators.length < 2))
    )
      throw new Error(
        `Invalid field-practice override: ${rule.ruleId} ${protocolId}`,
      );
  }
  fieldPracticeRuleIds.add(rule.ruleId);
}
const legacyProtocolAllowlistByProductId = new Map();
for (const entry of fieldPracticeGuidance.legacyProtocolAllowlist) {
  if (
    typeof entry.productId !== "string" ||
    legacyProtocolAllowlistByProductId.has(entry.productId) ||
    !Array.isArray(entry.protocolIds) ||
    entry.protocolIds.length === 0 ||
    !entry.protocolIds.every((protocolId) =>
      clinicalPathwayByProtocolId.has(protocolId),
    )
  )
    throw new Error(
      `Invalid legacy protocol allowlist: ${entry.productId ?? "unknown"}`,
    );
  legacyProtocolAllowlistByProductId.set(
    entry.productId,
    new Set(entry.protocolIds),
  );
}
const deniedProtocolIdsByProductId = new Map();
for (const entry of fieldPracticeGuidance.protocolDenylist) {
  if (
    typeof entry.productId !== "string" ||
    deniedProtocolIdsByProductId.has(entry.productId) ||
    !Array.isArray(entry.protocolIds) ||
    entry.protocolIds.length === 0 ||
    !entry.protocolIds.every((protocolId) =>
      clinicalPathwayByProtocolId.has(protocolId),
    )
  )
    throw new Error(
      `Invalid protocol denylist: ${entry.productId ?? "unknown"}`,
    );
  deniedProtocolIdsByProductId.set(entry.productId, new Set(entry.protocolIds));
}

if (
  fieldPracticeProtocols.schemaVersion !== "1.0.0" ||
  fieldPracticeProtocols.researchOnly !== true ||
  !Array.isArray(fieldPracticeProtocols.protocols) ||
  fieldPracticeProtocols.protocols.length === 0
)
  throw new Error(
    "Field-practice protocol definitions are missing or inconsistent",
  );
const sourceProtocolIds = new Set(protocols.map((item) => item.protocol_id));
const extensionProtocolIds = new Set();
const fieldPracticeProtocolSourceRef = (
  protocolId,
  page,
  claimId = protocolId,
) => ({
  claim_id: claimId,
  source_id: fieldPracticeGuidance.source.sourceId,
  source_snapshot_id: fieldPracticeGuidance.source.sourceSnapshotId,
  locator: `일반의약품 정리_센트럴파크약국.pdf p.${page} > 현장실습 제품군 선택 기준`,
  verified_at: fieldPracticeGuidance.source.fetchedAt,
});
for (const protocol of fieldPracticeProtocols.protocols) {
  if (
    typeof protocol.protocolId !== "string" ||
    sourceProtocolIds.has(protocol.protocolId) ||
    extensionProtocolIds.has(protocol.protocolId) ||
    !clinicalPathwayByProtocolId.has(protocol.protocolId) ||
    typeof protocol.displayName !== "string" ||
    typeof protocol.intent !== "string" ||
    typeof protocol.symptomCategory !== "string" ||
    !Array.isArray(protocol.aliases) ||
    protocol.aliases.length === 0 ||
    !Array.isArray(protocol.anchors) ||
    protocol.anchors.length === 0 ||
    !Array.isArray(protocol.keywords) ||
    !Array.isArray(protocol.negative) ||
    protocol.negative.length === 0 ||
    (protocol.activationStatus !== undefined &&
      protocol.activationStatus !== "no_registered_product") ||
    (protocol.activationStatus === "no_registered_product" &&
      (typeof protocol.activationNote !== "string" ||
        protocol.activationNote.length === 0)) ||
    !Number.isInteger(protocol.page) ||
    protocol.page < 1 ||
    protocol.page > fieldPracticeGuidance.source.pageCount
  )
    throw new Error(
      `Invalid field-practice protocol: ${protocol.protocolId ?? "unknown"}`,
    );
  extensionProtocolIds.add(protocol.protocolId);
}
const extensionProtocols = fieldPracticeProtocols.protocols
  // Every field-practice protocol ships, including the ones with no product in
  // the official registry. Dropping one does not make the system silent about
  // that condition — it lets a lexically adjacent protocol absorb the
  // utterance and recommend the wrong product, the way 구순포진 fell through to
  // PTC-MINOR_BURN and drew 후시딘·포비돈요오드 candidates. Shipping it with
  // zero options keeps the match correct and lets the safety gate return zero
  // candidates.
  .map((protocol) => {
    const suffix = protocol.protocolId.replace(/^PTC-/u, "");
    return {
      pack_id: "PACK-PHARMASSIST-KR-OTC-ACTUAL-20260713",
      protocol_id: protocol.protocolId,
      display_name: protocol.displayName,
      domain: "human_otc",
      intent: protocol.intent,
      symptom_category: protocol.symptomCategory,
      triggers: {
        aliases: protocol.aliases,
        anchors: protocol.anchors,
        keywords: protocol.keywords,
        // These terms are referral signals, not retrieval exclusions. Keeping
        // them only in the refer rule lets the protocol be retrieved so the
        // safety gate can return zero candidates.
        negative: [],
      },
      version: "1.0.0",
      status: "candidate",
      expires_at: "2027-01-13T00:00:00+09:00",
      option_ids: [],
      rule_ids: [
        `RUL-${suffix}-REFER-RED-FLAGS`,
        `RUL-${suffix}-SELECT-FALLBACK`,
      ],
      source_refs: [
        fieldPracticeProtocolSourceRef(
          protocol.protocolId,
          protocol.page,
          protocol.protocolId,
        ),
      ],
      review: {
        expires_at: "2027-01-13T00:00:00+09:00",
        notes:
          "현장실습 PDF와 공식 제품 정보를 결합한 연구 후보. 약사 검토 및 운영 승인 전 임상 사용 금지.",
        official_source_verified: false,
        pharmacist_approved: false,
        reviewed_at: null,
        reviewer_ids: [],
      },
    };
  });
const allProtocolTemplates = [...protocols, ...extensionProtocols];

const normalizedIngredientName = (value) =>
  value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, "");
const ingredientIdByName = new Map(
  ingredients.map((item) => [
    normalizedIngredientName(item.display_name_ko),
    item.ingredient_id,
  ]),
);
ingredientIdByName.set(
  normalizedIngredientName("디옥타헤드랄스멕타이트"),
  "ING-DIOSMECTITE",
);

for (const candidate of mfdsRegisteredIngredients) {
  const names = [candidate.display_name_ko, ...(candidate.source_names ?? [])];
  for (const name of names) {
    const key = normalizedIngredientName(name);
    if (key && !ingredientIdByName.has(key))
      ingredientIdByName.set(key, candidate.ingredient_id);
  }
}

const existingProductByItemSeq = new Map(
  products.map((item) => [item.item_seq, item]),
);
const enrichmentSource = (item) => {
  const sourceId = `SRC-MFDS-ENRICHMENT-${item.item_seq}`;
  const snapshotId = `SNAP-MFDS-ENRICHMENT-${item.item_seq}-20260714`;
  return {
    source: {
      source_snapshot_id: snapshotId,
      source_id: sourceId,
      provider: "mfds_permit",
      official: true,
      source_url: item.mfds.detail_url,
      fetched_at: item.mfds.verified_at,
      effective_at: null,
      terms_url: null,
      usage_rights: "unknown",
      commercial_use: "unknown",
      cache_policy: "unknown",
      redistribution: "unknown",
      ai_context_use: "unknown",
      http_status: 200,
      content_sha256: createHash("sha256")
        .update(JSON.stringify(item))
        .digest("hex"),
      content_type: "application/json+canonical-extract",
      parser_version: "gpt-pro-product-enrichment-v1",
      record_count: 1,
      page_count: 1,
      next_cursor: null,
      status: "parsed",
      raw_retention_policy: "none",
      uncertainty:
        "제품명·업체명·성분·공식 링크는 교차 확인됨. 이미지 재사용·공개 재배포 권리와 실제 소매 판매순위는 확인되지 않음.",
    },
    ref: {
      claim_id: `REG-ENR-${item.item_seq}`,
      source_id: sourceId,
      source_snapshot_id: snapshotId,
      locator: `식약처 품목정보 및 약학정보원 교차 확인 (item_seq=${item.item_seq})`,
      verified_at: item.mfds.verified_at,
    },
  };
};

const newSources = [];
newSources.push({
  source_snapshot_id: fieldPracticeGuidance.source.sourceSnapshotId,
  source_id: fieldPracticeGuidance.source.sourceId,
  provider: "other",
  official: false,
  source_url: fieldPracticeGuidance.source.sourceUrl,
  fetched_at: fieldPracticeGuidance.source.fetchedAt,
  effective_at: null,
  terms_url: null,
  usage_rights: "unknown",
  commercial_use: "unknown",
  cache_policy: "unknown",
  redistribution: "unknown",
  ai_context_use: "unknown",
  http_status: 200,
  content_sha256: fieldPracticeGuidance.source.contentSha256,
  content_type: "application/pdf",
  parser_version: "centralpark-field-practice-guidance-v1.0.0",
  record_count: fieldPracticeGuidance.profiles.length,
  page_count: fieldPracticeGuidance.source.pageCount,
  next_cursor: null,
  status: "parsed",
  raw_retention_policy: "none",
  uncertainty:
    "지역약국 실무실습 정리자료에서 제품 간 선택 기준을 구조화한 연구 미리보기입니다. 규제 근거 또는 약사 승인으로 간주하지 않으며 저작권과 재배포 권리는 확인 전입니다.",
});
const newProducts = [];
const unmappedIngredientSeeds = [];
const newProductIngredients = [];
const enrichmentIndex = [];
for (const item of productEnrichment) {
  const existing = existingProductByItemSeq.get(item.item_seq);
  const productId = existing?.product_id ?? `PRD-ENRICHED_${item.item_seq}`;
  const mappedIngredients = item.active_ingredients
    .map((active) => ({
      active,
      ingredientId: ingredientIdByName.get(
        normalizedIngredientName(active.name),
      ),
    }))
    .filter((entry) => entry.ingredientId);
  if (!existing) {
    const { source: enrichmentSnapshot, ref } = enrichmentSource(item);
    newSources.push(enrichmentSnapshot);
    // ING-UNMAPPED_* 는 이름 대조에 실패해서 붙은 자리표시자다. 이름이
    // 없어서가 아니라 라벨 원문("Guaifenesin 구아이페네신 2.5mg/mL")이
    // 등록명과 글자가 달라서였다. 실제 등록은 sourceIngredientName 이
    // 선언된 뒤에 한다. 여기서는 재료만 모은다.
    item.active_ingredients.forEach((active, index) => {
      const ingredientId =
        ingredientIdByName.get(normalizedIngredientName(active.name)) ??
        `ING-UNMAPPED_${item.item_seq}_${index + 1}`;
      if (!ingredientId.startsWith("ING-UNMAPPED_")) return;
      unmappedIngredientSeeds.push({
        ingredientId,
        rawName: active.name,
        snapshotId: enrichmentSnapshot.source_snapshot_id,
        ref,
      });
    });
    newProducts.push({
      product_id: productId,
      display_name: item.display_name,
      manufacturer: item.manufacturer,
      jurisdiction: "KR",
      item_seq: item.item_seq,
      permit_number: null,
      product_code: null,
      otc_status: item.otc_status,
      dosage_form: item.dosage_form,
      route: "경구",
      permit_status: item.permit_status,
      supply_performance: true,
      active_ingredients: item.active_ingredients.map((active, index) => ({
        ingredient_id:
          ingredientIdByName.get(normalizedIngredientName(active.name)) ??
          `ING-UNMAPPED_${item.item_seq}_${index + 1}`,
        name: active.name,
        strength_text: active.strength_text,
        normalized_amount: null,
        normalized_unit: null,
      })),
      status: "active",
      source_snapshot_ids: [enrichmentSnapshot.source_snapshot_id],
      source_refs: [ref],
      dur_flags: [],
    });
    for (const { active, ingredientId } of mappedIngredients)
      newProductIngredients.push({
        product_ingredient_id: `PRI-ENRICHED_${item.item_seq}_${ingredientId.replace(/^ING-/u, "")}`,
        product_id: productId,
        ingredient_id: ingredientId,
        strength_text: active.strength_text,
        normalized_amount: null,
        normalized_unit: null,
        role: "active",
        is_active: true,
        source_refs: [ref],
      });
  }
  enrichmentIndex.push({
    product_id: productId,
    item_seq: item.item_seq,
    display_name: item.display_name,
    manufacturer: item.manufacturer,
    mfds_url: item.mfds.detail_url,
    healthkr_url: item.healthkr.detail_url,
    image_url: `/product-images/${item.item_seq}.jpg`,
    image_sha256: item.image.sha256,
    image_rights: item.rights.image_reuse,
    retail_sales_rank_90d: item.popularity.retail_sales_rank_90d,
    popularity_source: item.popularity.source,
  });
}
const enrichedItemSeqs = new Set(
  productEnrichment.map((item) => item.item_seq),
);
for (const media of productMediaOverlays) {
  if (enrichedItemSeqs.has(media.item_seq)) continue;
  const product = existingProductByItemSeq.get(media.item_seq);
  if (!product)
    throw new Error(`Product media overlay item missing: ${media.item_seq}`);
  enrichmentIndex.push({
    product_id: product.product_id,
    item_seq: media.item_seq,
    display_name: product.display_name,
    manufacturer: product.manufacturer,
    mfds_url: `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${media.item_seq}`,
    healthkr_url: media.healthkr_url,
    image_url: media.source_image_url
      ? `/product-images/${media.item_seq}.jpg`
      : null,
    image_rights: "unknown",
    retail_sales_rank_90d: null,
    popularity_source: "tenant_pos_required",
  });
}

if (
  healthKrRegistry.schemaVersion !== "1.0.0" ||
  healthKrRegistry.source?.recordCount !== healthKrRegistry.records?.length ||
  healthKrRegistryManifest.outputs?.registry?.contentSha256 !==
    healthKrRegistryContentSha256
)
  throw new Error("Health.kr product registry is missing or inconsistent");

const compactClinicalText = (value, maxLength = 360) => {
  if (typeof value !== "string") return "";
  const compact = value
    .replace(/<\/?(?:sub|sup|br)\s*>/giu, " ")
    .replace(/<([^<>]+)>/gu, "$1")
    .replace(/\bbr\b/giu, "\n")
    .replace(/\s+/gu, " ")
    .trim();
  if (compact.length <= maxLength) return compact;
  const clipped = compact.slice(0, maxLength);
  const boundary = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("다. "),
    clipped.lastIndexOf("; "),
  );
  return `${clipped.slice(0, boundary > 80 ? boundary + 1 : maxLength).trim()}…`;
};

const healthKrSnapshotId = `SNAP-HEALTHKR-REGISTRY-${healthKrRegistryContentSha256.slice(0, 16).toUpperCase()}`;
const healthKrSourceId = "SRC-HEALTHKR-LOCAL-REGISTRY";
const legacyProducts = [...products, ...newProducts];
const healthKrImportedRecords = healthKrRegistry.records.filter(
  (record) =>
    clinicalPathwayByRegistryRecordId.get(record.registryRecordId)
      ?.mappingStatus === "direct" &&
    record.officialMatch.status === "confirmed" &&
    record.officialProduct?.otcStatus === "otc" &&
    !record.officialProduct.permit.cancelled &&
    record.officialMatch.evidence.conflicts.length === 0,
);
if (healthKrImportedRecords.length > 0)
  newSources.push({
    source_snapshot_id: healthKrSnapshotId,
    source_id: healthKrSourceId,
    provider: "health_kr",
    official: true,
    source_url: "https://www.health.kr/",
    fetched_at: healthKrRegistry.generatedAt,
    effective_at: null,
    terms_url: null,
    usage_rights: "unknown",
    commercial_use: "unknown",
    cache_policy: "unknown",
    redistribution: "unknown",
    ai_context_use: "unknown",
    http_status: 200,
    content_sha256: healthKrRegistryContentSha256,
    content_type: "application/json+normalized-registry",
    parser_version: "healthkr-local-registry-v1.0.0",
    record_count: healthKrRegistry.records.length,
    page_count: 1,
    next_cursor: null,
    status: "parsed",
    raw_retention_policy: "none",
    uncertainty:
      "로컬에 수집된 약학정보원 연결 결과를 정규화한 연구 미리보기입니다. confirmed 연결만 자동 후보로 사용하며 실제 약사 승인과 운영 승격은 별도입니다.",
  });

const healthKrProducts = [];
const healthKrProductIngredients = [];
const healthKrSourceRef = (record) => ({
  claim_id: `CLM-${record.registryRecordId.replace(/^REG-/u, "")}`,
  source_id: healthKrSourceId,
  source_snapshot_id: healthKrSnapshotId,
  locator: record.officialProduct.sourceUrl,
  verified_at: record.officialMatch.checkedAt ?? healthKrRegistry.generatedAt,
});
const healthKrDurFlags = (official) => {
  const flags = [];
  const append = (section, type, code, blocking) => {
    if (!section?.present) return;
    for (const description of section.entries)
      flags.push({ type, code, description, effective_date: null, blocking });
  };
  append(
    official.dur.contraindications,
    "coadministration",
    "HEALTHKR_DUR_CONTRAINDICATION",
    true,
  );
  append(official.dur.age, "age", "HEALTHKR_DUR_AGE", true);
  append(official.dur.pregnancy, "pregnancy", "HEALTHKR_DUR_PREGNANCY", true);
  append(official.dur.senior, "elderly", "HEALTHKR_DUR_SENIOR", true);
  append(official.dur.maxDose, "dose", "HEALTHKR_DUR_MAX_DOSE", false);
  append(official.dur.maxPeriod, "duration", "HEALTHKR_DUR_MAX_PERIOD", false);
  append(official.dur.splitDosage, "split", "HEALTHKR_DUR_SPLIT", false);
  return flags;
};
const healthKrInteractionTerms = (official) => [
  ...new Set(
    official.interactions.flatMap((interaction) =>
      interaction.cells
        .slice(0, 4)
        .map((cell) => compactClinicalText(cell, 80))
        .filter((cell) => cell && cell !== "해당제품"),
    ),
  ),
];
const mechanismSelectionGuidance = {
  acid_control: "위산 역류 자체를 줄이는 작용이 필요한 경우",
  acid_neutralization: "이미 나온 위산을 빠르게 중화하는 쪽이 필요한 경우",
  acid_suppression: "반복되는 위산 분비를 오래 억제하는 쪽이 필요한 경우",
  adsorbent: "묽은 설사에서 장운동 억제보다 흡착과 점막 보호를 우선하는 경우",
  analgesia: "통증 완화가 주된 목표인 경우",
  anticholinergic: "멀미에서 구역과 어지럼을 줄이는 항콜린 작용이 필요한 경우",
  antihistamine: "알레르기성 콧물·재채기·가려움이 두드러지는 경우",
  antimicrobial: "공식 적응증에 맞는 항균 성분 포함 복합제를 검토하는 경우",
  antiinflammatory_analgesia: "염증을 동반한 관절·근육 통증이나 월경통인 경우",
  antipyretic: "발열과 몸살 통증을 함께 낮춰야 하는 경우",
  antipruritic: "가려움 완화가 가장 중요한 경우",
  antiseptic: "가벼운 상처나 구강 부위의 살균이 필요한 경우",
  topical_antibiotic:
    "화농·감염 소견이 있는 상처에서 국소 항생제 적응증을 확인한 경우",
  antispasmodic: "쥐어짜는 양상의 경련성 통증이 함께 있는 경우",
  bile_support: "지방식 뒤 더부룩함처럼 담즙 보조가 필요한 소화불량인 경우",
  bulk_laxative: "변의 부피와 수분을 늘리는 완만한 변비 관리가 필요한 경우",
  central_analgesia: "발열·두통처럼 중추성 통증 완화가 필요한 경우",
  cough_support: "인후 불편과 함께 기침 완화도 필요한 경우",
  cough_suppression: "가래보다 마른기침 억제가 우선인 경우",
  decongestant: "콧물보다 코막힘이 더 불편한 경우",
  digestive_enzyme: "과식이나 음식 소화 저하가 중심인 경우",
  digestion_support: "체함과 더부룩함을 함께 완화해야 하는 경우",
  diuretic_support: "월경통과 함께 붓기·복부팽만이 있는 경우",
  expectorant: "가래를 묽게 하거나 배출을 도와야 하는 경우",
  gas_reduction: "가스와 복부팽만이 주된 불편인 경우",
  herbal_support: "공식 적응증에 맞는 생약 복합 보조를 함께 검토하는 경우",
  herbal_antidiarrheal:
    "정로환·오령산 계열처럼 설사 적응증이 있는 생약 복합제를 검토하는 경우",
  local_analgesia: "통증 부위에 국소적으로 작용하는 제형이 필요한 경우",
  local_antiinflammatory:
    "피부·구강·인후의 국소 염증을 직접 완화해야 하는 경우",
  local_support: "먹는 약과 별도로 통증 부위를 국소 관리해야 하는 경우",
  motility_reduction:
    "발열·혈변 같은 위험 신호가 없는 설사에서 잦은 배변을 줄여야 하는 경우",
  motility_regulation:
    "위장 운동 저하나 불규칙한 운동이 소화불량의 중심인 경우",
  mucolytic: "끈적한 가래를 묽게 만들어 배출해야 하는 경우",
  mucosal_barrier: "역류나 자극으로부터 식도·위 점막을 덮어 보호해야 하는 경우",
  mucosal_protection: "위장 또는 구강 점막의 자극과 통증을 보호해야 하는 경우",
  nasal_local_support: "전신 복용약보다 코에 직접 쓰는 국소 관리가 필요한 경우",
  ocular_lubrication: "건조감과 이물감에 윤활·보습이 필요한 경우",
  official_indication_match:
    "공식 효능·효과는 현재 증상과 맞지만 세부 기전 비교 근거가 부족한 경우",
  oral_antiseptic: "구내염 부위의 구강 살균이 필요한 경우",
  osmotic_laxative: "딱딱한 변에 수분을 끌어들여 부드럽게 해야 하는 경우",
  peripheral_analgesia: "염증성·말초성 통증을 낮추는 작용이 필요한 경우",
  secretion_reduction: "콧물과 분비물이 많은 경우",
  stimulant_laxative: "단기간에 장운동을 직접 자극해야 하는 변비인 경우",
  stool_softener: "힘주기 어려운 변을 부드럽게 해야 하는 경우",
  symptom_specific_gastrointestinal:
    "복통·구역·구토 등 제품의 공식 적응증과 현재 증상이 직접 맞는 경우",
  tissue_repair: "상처 부위의 피부 회복을 보조해야 하는 경우",
  vitamin_support: "통증 치료와 별도로 비타민·미네랄 보조를 검토하는 경우",
  wound_protection: "가벼운 상처를 외부 자극에서 보호해야 하는 경우",
};
const ingredientSelectionLabel = (value) => {
  const text = String(value ?? "")
    .normalize("NFKC")
    .trim();
  const korean = text.match(/[가-힣][가-힣0-9·\- ]*/u)?.[0];
  return (korean ?? text).replace(/\s+\d[\s\S]*$/u, "").trim();
};
const selectionEvidenceIdentity = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/gu, "");
const dosagePopulationLabel = (dosage, productName = "") => {
  const text = String(dosage ?? "");
  const pediatric =
    /(?:만\s*)?\d+(?:\.\d+)?\s*(?:개월|세)|소아|어린이/u.test(text) ||
    /키즈|어린이|소아|꼬마/u.test(productName);
  const adult = /성인/u.test(text);
  if (pediatric && adult) return "성인·소아 연령별 용량이 구분된 제품";
  if (pediatric) return "소아 연령별 용량이 확인된 제품";
  if (adult) return "성인 용량이 확인된 제품";
  return null;
};
const evidenceMechanismsFor = (pathway, evidenceValues) => {
  if (pathway.mechanisms.length === 1) return pathway.mechanisms;
  const evidence = selectionEvidenceIdentity(evidenceValues.join(" "));
  const supported = pathway.mechanisms.filter((mechanism) =>
    (clinicalPathwayDefinitions.mechanismEvidence?.[mechanism] ?? []).some(
      (term) => evidence.includes(selectionEvidenceIdentity(term)),
    ),
  );
  return supported.length > 0 ? supported : ["official_indication_match"];
};
const contextualSelectionGuidance = ({
  protocolId,
  mechanisms,
  productName,
  ingredients,
  ingredientEvidence = ingredients,
  dosageForm,
  route,
  matchedTerms = [],
}) => {
  const evidence = selectionEvidenceIdentity(
    [productName, ingredientEvidence.join(" "), dosageForm, route].join(" "),
  );
  const has = (...terms) =>
    terms.some((term) => evidence.includes(selectionEvidenceIdentity(term)));
  const pediatric = has("어린이", "키즈", "소아", "챔프", "시럽");
  const coldCombination = has(
    "클로르페니라민",
    "덱스트로메토르판",
    "구아이페네신",
    "슈도에페드린",
    "메틸에페드린",
    "티페피딘",
  );
  const oralSolidOrLiquid = /정제|캡슐|시럽/u.test(
    `${dosageForm ?? ""} ${route ?? ""}`,
  );

  if (protocolId === "PTC-FEVER") {
    if (coldCombination)
      return "발열과 함께 콧물·코막힘·기침 같은 감기 증상도 있어 복합제를 검토하는 경우";
    if (pediatric)
      return "아이가 정제를 삼키기 어려워 액상 해열진통제가 필요한 경우";
  }
  if (protocolId === "PTC-HEADACHE") {
    if (has("나프록센"))
      return "한쪽으로 오래 지속되는 편두통처럼 지속력이 중요한 경우";
    if (has("이부프로펜", "덱시부프로펜"))
      return "근육 긴장이나 염증성 통증이 동반된 두통을 검토하는 경우";
    if (pediatric)
      return "소아 두통에서 연령·체중별 용량이 확인된 액상 진통제가 필요한 경우";
    if (has("아세트아미노펜"))
      return "염증 억제보다 두통·발열의 진통 효과를 우선하는 경우";
  }
  if (protocolId === "PTC-MENSTRUAL_PAIN") {
    if (has("파마브롬"))
      return "생리통과 함께 붓기·복부 팽만감이 있어 이뇨 보조 성분도 필요한 경우";
    if (has("이부프로펜", "덱시부프로펜", "나프록센"))
      return "염증성 생리통의 통증과 경련 완화를 우선하는 경우";
  }
  if (protocolId === "PTC-JOINT_PAIN") {
    if (has("나프록센"))
      return "오래 지속되는 허리·관절의 말초 염증성 통증에서 지속력을 우선하는 경우";
    if (has("겔", "연고", "플라스타", "카타플라스마", "외용"))
      return "관절 통증 부위에 먹는 약보다 국소 제형을 직접 적용하려는 경우";
    return "붓기나 염증을 동반한 관절 통증에 소염진통 작용이 필요한 경우";
  }
  if (protocolId === "PTC-MUSCLE_PAIN") {
    if (has("클로르족사존", "메토카르바몰"))
      return "근육이 뭉치거나 경련성 통증이 있어 근이완 성분을 함께 검토하는 경우";
    if (has("겔", "연고", "플라스타", "카타플라스마", "외용"))
      return "한정된 근육 통증 부위에 국소 제형을 직접 적용하려는 경우";
    return "몸살이 아니라 근육통 자체의 진통 완화가 필요한 경우";
  }
  if (protocolId === "PTC-RUNNY_NOSE") {
    if (coldCombination && has("아세트아미노펜"))
      return "콧물과 함께 발열·몸살·기침 등 여러 감기 증상이 같이 있는 경우";
    if (has("슈도에페드린", "페닐레프린"))
      return "콧물과 코막힘이 함께 있어 항히스타민과 비충혈제거 작용을 같이 검토하는 경우";
    return "재채기·맑은 콧물·가려움이 두드러지는 알레르기성 콧물인 경우";
  }
  if (protocolId === "PTC-ALLERGIC_RHINITIS") {
    if (has("펙소페나딘"))
      return "운전·업무 때문에 졸림을 가장 줄여야 하는 알레르기 비염인 경우";
    if (has("로라타딘"))
      return "알레르기 비염에서 효과와 졸림 감소의 균형을 우선하는 경우";
    if (has("세티리진"))
      return pediatric
        ? "소아 알레르기 비염에서 연령별 액상 용량이 확인된 세티리진이 필요한 경우"
        : "알레르기 증상 완화 효과를 우선하고 졸림 가능성을 감수할 수 있는 경우";
  }
  if (protocolId === "PTC-NASAL_CONGESTION") {
    if (has("자일로메타졸린"))
      return "코막힘에 빠르게 작용하는 4~6시간 지속 국소 스프레이가 필요한 경우";
    if (has("옥시메타졸린"))
      return "코막힘에 빠르게 작용하고 약 12시간 지속하는 국소 스프레이가 필요한 경우";
    if (coldCombination && has("아세트아미노펜"))
      return "코막힘과 함께 발열·기침·콧물 등 여러 감기 증상이 같이 있는 경우";
    if (has("슈도에페드린", "페닐레프린"))
      return "먹는 약으로 코막힘을 줄이되 동반 성분과 졸림 가능성을 함께 확인하는 경우";
  }
  if (protocolId === "PTC-PRODUCTIVE_COUGH") {
    if (has("아세틸시스테인", "암브록솔", "브롬헥신", "카르보시스테인"))
      return "끈적하고 배출하기 어려운 가래를 묽게 하는 작용이 우선인 경우";
    if (coldCombination)
      return "기침과 가래에 콧물·코막힘·통증 같은 감기 증상도 함께 있는 경우";
    return "가래를 묽게 하거나 배출을 도와야 하는 기침인 경우";
  }
  if (protocolId === "PTC-DRY_COUGH") {
    if (coldCombination && has("아세트아미노펜"))
      return "마른기침과 함께 발열·인후통·콧물 같은 감기 증상도 있는 경우";
    return "가래보다 마른기침 억제가 우선인 경우";
  }
  if (protocolId === "PTC-SORE_THROAT") {
    if (coldCombination && has("아세트아미노펜"))
      return "인후통과 함께 발열·기침·콧물 같은 감기 증상도 있는 경우";
    if (has("트로키", "스프레이", "가글", "액"))
      return "인후의 국소 통증·염증 부위에 직접 사용하는 제형이 필요한 경우";
  }
  if (protocolId === "PTC-URTICARIA_ITCH") {
    if (has("펙소페나딘"))
      return "두드러기·전신 가려움에서 졸림을 가장 줄여야 하는 경우";
    if (has("로라타딘"))
      return "두드러기·전신 가려움에서 효과와 졸림 감소의 균형을 우선하는 경우";
    if (has("세티리진"))
      return pediatric
        ? "소아 두드러기·가려움에 연령별 액상 용량이 확인된 세티리진이 필요한 경우"
        : "두드러기·전신 가려움 완화 효과를 우선하고 졸림 가능성을 감수할 수 있는 경우";
    return "두드러기와 전신 가려움에 먹는 항히스타민제가 필요한 경우";
  }
  if (protocolId === "PTC-INSECT_BITE") {
    if (oralSolidOrLiquid)
      return "벌레 물림 뒤 가려움이 넓게 퍼져 먹는 항히스타민제를 검토하는 경우";
    return "벌레 물린 국소 부위의 가려움과 염증을 직접 완화하는 외용제가 필요한 경우";
  }
  if (protocolId === "PTC-MILD_DERMATITIS")
    return "감염이나 진균 소견이 없는 가벼운 습진·피부염의 가려움과 염증을 줄이는 경우";
  if (protocolId === "PTC-MINOR_WOUND") {
    if (has("퓨시드산", "무피로신"))
      return "화농·감염 소견이 있는 상처에서 국소 항생제 적응증을 확인한 경우";
    if (has("포비돈", "클로르헥시딘", "세틸피리디늄"))
      return "가벼운 상처를 넓은 범위로 소독해야 하는 경우";
    return "감염 소견이 없는 가벼운 상처의 보호와 피부 회복을 보조하는 경우";
  }
  if (protocolId === "PTC-ABDOMINAL_PAIN_VOMITING") {
    if (has("트리메부틴"))
      return "소화불량과 함께 위장 운동이 불규칙해 복통·구역이 나타나는 경우";
    if (has("로페라미드", "비스무트", "베르베린"))
      return "설사와 함께 복통·구역이 나타나고 감염 위험 신호는 없는 경우";
    if (has("소화효소", "디아스타제", "프로테아제"))
      return "과식·체함 뒤 소화불량과 함께 복통·구역이 나타나는 경우";
    if (has("디오스멕타이트", "스멕타이트"))
      return "묽은 설사와 함께 복통이 있어 흡착·점막 보호가 필요한 경우";
    if (has("인산알루미늄", "수산화마그네슘", "알긴산"))
      return "속쓰림·신트림·위산과다와 함께 윗배 통증이나 구역이 나타나는 경우";
    return "복통에 구역이나 구토가 함께 있는 경우";
  }
  if (protocolId === "PTC-CONSTIPATION")
    return "변이 딱딱하거나 며칠째 배변이 어려운 경우";
  if (protocolId === "PTC-DIARRHEA")
    return "감염 위험 신호가 없는 설사가 이어지는 경우";
  if (protocolId === "PTC-MENSTRUAL_PAIN")
    return "생리통이 주된 불편이고 먹는 진통제로 다루는 경우";
  if (protocolId === "PTC-NASAL_CONGESTION")
    return "알레르기성 코막힘을 먹는 약으로 조절하려는 경우";
  if (protocolId === "PTC-SORE_THROAT")
    return "목 통증이 주된 불편이고 먹는 진통제로 다루는 경우";
  if (protocolId === "PTC-STOMATITIS")
    return "입안이 헐어 국소제를 바르거나 헹구려는 경우";
  if (protocolId === "PTC-ANTIFUNGAL_SKIN") {
    if (has("테르비나핀", "나프티핀"))
      return "발가락 사이·발바닥의 전형적인 피부사상균성 무좀에서 짧은 치료 기간을 우선하는 경우";
    if (has("클로트리마졸", "에코나졸"))
      return "무좀뿐 아니라 완선·체부백선·어루러기처럼 병변 범위가 다양해 광범위 아졸계가 필요한 경우";
    if (has("시클로피록스"))
      return "두꺼운 각질이나 손발톱 주변 병변처럼 제형과 도포 부위에 맞춘 항진균제가 필요한 경우";
    if (has("케토코나졸"))
      return "지루성 피부염이나 어루러기와 함께 말라세지아 관련 병변을 의심하는 경우";
    return "병변 위치와 진균 양상을 확인한 뒤 공식 백선·무좀 적응증에 맞는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-ACNE") {
    if (has("벤조일퍼옥사이드"))
      return "붉고 염증성인 여드름에서 면포 용해와 여드름균 감소를 함께 기대하는 경우";
    if (has("살리실산"))
      return "피지와 각질이 막힌 좁쌀·면포성 여드름에서 각질 용해를 우선하는 경우";
    if (has("아젤라산"))
      return "면포와 염증 뒤 색소침착을 함께 고려해 자극이 비교적 적은 성분을 원하는 경우";
    if (has("퓨시드산", "무피로신"))
      return "긁거나 터뜨린 여드름에 이차 세균감염 소견이 있어 국소 항생제 적응증을 확인한 경우";
    return "면포·염증·화농 여부를 구분해 공식 여드름 적응증이 있는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-HEMORRHOID") {
    if (has("디오스민"))
      return "치핵의 붓기·출혈과 정맥 울혈을 안쪽에서 보조하는 경구제가 필요한 경우";
    if (has("리도카인"))
      return "치열·치핵의 국소 통증과 가려움이 두드러져 빠른 국소 마취 효과가 필요한 경우";
    if (has("히드로코르티손"))
      return "감염 소견 없이 치핵의 염증·가려움·부종이 두드러져 단기간 스테로이드 국소제를 검토하는 경우";
    return "출혈·통증·돌출 양상과 제형 사용 가능 여부를 확인해 치질 국소제 또는 정맥순환 보조제를 고르는 경우";
  }
  if (protocolId === "PTC-EYE_ALLERGY") {
    if (has("케토티펜", "크로모글리크산"))
      return "양쪽 눈의 알레르기성 가려움이 반복되고 통증·시력저하가 없어 항알레르기 점안제가 필요한 경우";
    if (has("나파졸린", "테트라히드로졸린"))
      return "단순 충혈이 주증상이고 녹내장 위험·장기 사용을 피할 수 있어 혈관수축 점안제를 짧게 쓰는 경우";
    if (has("페니라민"))
      return "충혈과 알레르기성 가려움이 함께 있어 항히스타민·충혈 완화 복합 점안제를 검토하는 경우";
    return "건조감이 아니라 알레르기성 가려움·충혈이 주증상이고 통증·시력저하가 없는 경우";
  }
  if (protocolId === "PTC-MINOR_BURN") {
    if (has("구아야줄렌"))
      return "물집이 없는 가벼운 1도 화상에서 냉각 뒤 염증과 화끈거림을 진정시키는 경우";
    if (has("트롤아민", "베타시토스테롤"))
      return "작은 물집이 생긴 얕은 2도 화상에서 피부 보호와 습윤 환경 유지가 필요한 경우";
    if (has("퓨시드산", "네오마이신"))
      return "가벼운 화상 자체가 아니라 화상 부위의 이차 세균감염이 확인되거나 강하게 의심되는 경우";
    if (has("덱스판테놀"))
      return "감염 소견이 없는 가벼운 화상에서 피부 장벽 회복을 보조하는 외용제가 필요한 경우";
    if (has("포비돈요오드"))
      return "화상 부위에 오염이 있어 살균소독이 필요하지만 조직 손상을 늘릴 반복 사용은 피하는 경우";
    return "넓거나 깊지 않은 화상에서 충분히 식힌 뒤 공식 화상 적응증이 있는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-SCALP_DANDRUFF") {
    if (has("케토코나졸"))
      return "기름진 비듬과 가려움이 반복되는 지루성 두피에서 말라세지아 억제 샴푸가 필요한 경우";
    if (has("시클로피록스"))
      return "케토코나졸과 다른 항진균 기전의 지루성 두피 치료용 샴푸를 검토하는 경우";
    return "두피의 비듬·지루성 피부염이 주증상이고 진물·고름·탈모 반점이 없는 경우";
  }
  if (protocolId === "PTC-HYPERHIDROSIS") {
    if (has("글리코피롤레이트"))
      return "안면 다한증에서 눈·입 주변을 피할 수 있고 항콜린성 국소제를 검토하는 경우";
    if (has("염화알루미늄"))
      return "겨드랑이·손·발의 국소 다한증에서 땀샘 관을 막는 외용제를 마른 피부에 쓰는 경우";
    return "전신 식은땀 원인이 아니라 특정 부위 다한증에 공식 적응증이 있는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-SLEEP_AID") {
    if (has("독실아민"))
      return "다음 날까지 졸림이 이어질 수 있음을 감수하고 비교적 지속적인 단기 수면 보조가 필요한 경우";
    if (has("디펜히드라민"))
      return "일시적으로 잠들기 어려운 성인이 다음 날 운전·음주를 피할 수 있어 단기 수면 보조를 원하는 경우";
    return "2주 미만의 일시적 입면 곤란이고 호흡·우울·약물 원인을 먼저 배제한 경우";
  }
  if (protocolId === "PTC-VAGINAL_ANTIFUNGAL") {
    if (has("클로트리마졸"))
      return "심한 냄새·발열·골반통 없이 흰 치즈양 분비물과 가려움이 있어 칸디다 질염을 의심하는 경우";
    if (has("니푸라텔", "니스타틴"))
      return "칸디다 외 혼합 감염 가능성을 진단받았거나 해당 복합제의 공식 적응증을 확인한 경우";
    if (has("포비돈요오드"))
      return "칸디다·트리코모나스·비특이성 또는 혼합 질염에 공식 적응증이 있는 광범위 질세정제를 검토하되 임신·갑상선 질환을 먼저 확인하는 경우";
    return "처음이거나 반복되는 원인 불명 질염이 아니라 전형적인 칸디다 증상에 공식 질용 항진균제를 고르는 경우";
  }
  if (protocolId === "PTC-SMOKING_CESSATION") {
    if (has("니코레트껌4mg"))
      return "하루 20개비를 초과해 피우거나 2mg 니코틴껌으로 금연에 실패한 경우";
    if (has("니코레트껌2mg", "니코틴엘껌2mg"))
      return "하루 20개비 이하를 피우며 갑작스러운 흡연 욕구를 필요할 때 조절하려는 경우";
    if (has("tts30"))
      return "하루 20개비 이상 피우는 심한 흡연자가 패치 단계 감량을 시작하는 경우";
    if (has("tts20"))
      return "하루 20개비 이하 흡연자가 패치를 시작하거나 고용량 패치에서 감량하는 경우";
    if (has("tts10"))
      return "니코틴 패치 치료의 마지막 단계에서 보충량을 줄이는 경우";
    if (has("껌", "로젠지", "트로키"))
      return "갑자기 올라오는 흡연 욕구를 필요할 때 조절하고 씹기·구강 사용법을 지킬 수 있는 경우";
    if (has("패치", "경피"))
      return "하루 종일 일정한 니코틴 보충이 필요하고 피부 부착제를 매일 교체할 수 있는 경우";
    return "하루 흡연량과 첫 흡연 시간을 확인해 적절한 강도의 니코틴 대체제를 고르는 경우";
  }
  if (protocolId === "PTC-SCAR_CARE") {
    if (has("실리콘"))
      return "상처가 완전히 닫힌 뒤 솟거나 붉은 수술·외상 흉터를 넓게 덮어 관리하는 경우";
    if (has("헤파린", "양파"))
      return "상처가 닫힌 뒤 단단하거나 당기는 흉터에 마사지 가능한 겔 제형을 원하는 경우";
    return "열린 상처·감염이 없는 회복된 흉터에서 흉터 형태와 면적에 맞는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-PIGMENTATION") {
    if (has("히드로퀴논"))
      return "기미·주근깨·염증 후 색소침착에 자외선 차단을 병행하며 국소 탈색제를 제한된 기간 쓰는 경우";
    if (has("아젤라산"))
      return "여드름과 함께 남은 색소침착을 관리하면서 히드로퀴논보다 다른 기전을 원하는 경우";
    return "빠르게 변하는 점이 아닌 기미·주근깨·염증 후 색소침착에 공식 외용 적응증을 확인한 경우";
  }
  if (protocolId === "PTC-ORAL_HERPES") {
    if (has("아시클로버"))
      return "입술이 따끔거리거나 작은 물집이 막 생긴 구순포진 초기라 항바이러스 외용제를 일찍 시작하는 경우";
    if (has("티로트리신"))
      return "구순포진 물집이 터진 뒤 작은 상처의 이차 세균감염 예방을 위한 국소 항균제를 검토하는 경우";
    return "눈 주변이 아닌 재발성 구순포진에서 물집 전후 단계에 맞는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-DRY_SKIN") {
    if (has("요소", "우레아"))
      return "단순 보습만으로 부족한 두껍고 거친 각질·갈라짐에 각질연화와 보습이 함께 필요한 경우";
    if (has("헤파리노이드"))
      return "건조하고 거친 피부에 보습과 혈행 보조를 함께 기대하되 출혈 위험을 확인한 경우";
    return "진물·고름이 없는 건조 피부에서 보습 또는 각질연화 기전에 맞는 외용제를 고르는 경우";
  }
  if (protocolId === "PTC-BRUISE") {
    if (has("헤파린", "헤파리노이드"))
      return "피부가 벗겨지지 않은 단순 멍·타박상에서 국소 혈종과 부종 완화를 보조하는 경우";
    return "골절·머리 외상·원인 없는 반복 멍이 아닌 가벼운 타박상에 공식 외용 적응증을 확인한 경우";
  }
  if (protocolId === "PTC-CORN_WART") {
    if (has("밴드", "플라스타"))
      return "압박점이 분명한 작은 티눈을 정확히 덮어 살리실산을 제한된 부위에 적용하는 경우";
    if (has("액", "콜로디온"))
      return "티눈·사마귀 모양에 맞춰 정상 피부를 피하면서 액상 각질용해제를 바를 수 있는 경우";
    return "당뇨·순환장애가 없고 티눈·사마귀가 얼굴이나 점막이 아닌 곳에 있는 경우";
  }
  if (protocolId === "PTC-ORAL_CONTRACEPTION") {
    if (has("디어미순"))
      return "게스토덴 0.06mg·에티닐에스트라디올 0.015mg의 24일 활성약+4일 위약 일정을 매일 이어서 복용할 수 있는 경우";
    if (has("마이보라"))
      return "게스토덴 0.075mg·에티닐에스트라디올 0.03mg의 21일 복용+7일 휴약 일정을 선택한 경우";
    if (has("센스리베", "디어미정"))
      return "게스토덴 0.075mg·에티닐에스트라디올 0.02mg의 21일 복용+7일 휴약 일정을 선택한 경우";
    if (has("머시론", "센스데이"))
      return "데소게스트렐 0.15mg·에티닐에스트라디올 0.02mg의 21일 복용+7일 휴약 일정을 선택한 경우";
    if (has("레보노르게스트렐"))
      return "경구피임을 처음 시작하며 혈전 위험을 확인한 뒤 레보노르게스트렐 함유 저용량 복합제를 우선 검토하는 경우";
    if (has("데소게스트렐", "게스토덴"))
      return "피임 효과 외 여드름·주기 증상도 고려하되 세대별 혈전 위험 차이를 설명한 경우";
    return "임신 가능성과 혈전 위험을 먼저 배제하고 피임·월경 지연 목적에 맞춰 복용 일정을 정하는 경우";
  }
  if (protocolId === "PTC-GUM_INFLAMMATION") {
    if (has("리소짐", "카르바조크롬"))
      return "치과 치료를 대신하지 않고 경·중등도 치은염·치주염 치료 뒤 붓기와 출혈을 보조하는 경우";
    return "얼굴 부종·고열·고름이 없고 치은염·치주염의 보조치료 적응증이 확인된 경우";
  }

  const statements = mechanisms
    .map((mechanism) => mechanismSelectionGuidance[mechanism])
    .filter(Boolean);
  if (statements.length > 0) return [...new Set(statements)].join(" 또는 ");
  const matched = [...new Set(matchedTerms)].join("·");
  return matched
    ? `공식 효능에 ${matched}가 포함된 ${dosageForm ?? "제품"}을 검토하는 경우`
    : "제품의 공식 효능·효과와 현재 증상이 직접 맞는 경우";
};
const healthKrSelectionProfiles = (record, pathwayMapping) => {
  const official = record.officialProduct;
  const ingredients = pathwayMapping.ingredientMappings
    .map((mapping) => ingredientSelectionLabel(mapping.sourceText))
    .filter(Boolean)
    .slice(0, 3);
  const form = [official.dosageForm, official.route]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" · ");
  const population = dosagePopulationLabel(official.dosage, official.itemName);
  return pathwayMapping.pathways.map((pathway) => {
    const differentiators = [
      ingredients.length > 0 ? `주요 성분: ${ingredients.join(", ")}` : null,
      form ? `제형·투여경로: ${form}` : null,
      population ? `복용 대상: ${population}` : null,
      pathway.combinationRole === "supportive"
        ? "주증상 치료를 대신하기보다 보조 역할로 검토"
        : "현재 증상 경로에서 직접 작용하는 1차 역할로 검토",
    ].filter(Boolean);
    const dosagePoint = compactClinicalText(official.dosage, 180);
    return {
      protocol_id: pathway.protocolId,
      fit_score: pathway.score,
      choose_when: contextualSelectionGuidance({
        protocolId: pathway.protocolId,
        mechanisms: pathway.mechanisms,
        productName: official.itemName,
        ingredients,
        ingredientEvidence: pathwayMapping.ingredientMappings.map(
          (mapping) => mapping.sourceText,
        ),
        dosageForm: official.dosageForm,
        route: official.route,
        matchedTerms: pathway.matchedTerms,
      }),
      differentiators,
      comparison_note:
        pathway.combinationRole === "supportive"
          ? "직접 치료형 후보와 같은 순위로 보지 않고 보조 후보로 구분합니다."
          : "같은 증상 후보 중 성분 기전과 제형이 현재 불편에 더 직접 맞을 때 우선합니다.",
      practical_points: dosagePoint ? [dosagePoint] : [],
      evidence_source: pathway.source,
    };
  });
};
const healthKrProductMetadata = (record, pathwayMapping) => {
  const official = record.officialProduct;
  return {
    manufacturer: official.manufacturer,
    dosage_form: official.dosageForm,
    route: official.route,
    official_match_status: "confirmed",
    official_product_key: official.productKey,
    official_source_url: official.sourceUrl,
    retail_offer: {
      sku_id: record.retailOffer.skuId,
      display_name: record.retailOffer.displayName,
      specification: record.retailOffer.specification,
      displayed_price_krw: record.retailOffer.displayedPriceKrw,
      recorded_at: record.retailOffer.recordedAt,
      price_status: record.retailOffer.priceStatus,
      image_url: record.retailOffer.image.url,
      image_source_url: record.retailOffer.image.sourceUrl,
      image_rights_status: record.retailOffer.image.rightsStatus,
      image_kind: record.retailOffer.image.kind,
      image_checked_at: record.retailOffer.image.checkedAt,
    },
    clinical_group_key: pathwayMapping
      ? [
          ...pathwayMapping.ingredientMappings.map(
            (mapping) => mapping.ingredientId,
          ),
          official.route ?? "",
          official.dosageForm ?? "",
        ].join("|")
      : record.recommendation.clinicalGroupKey,
    pathway_profiles: pathwayMapping
      ? pathwayMapping.pathways.map((pathway) => ({
          protocol_id: pathway.protocolId,
          mechanisms: pathway.mechanisms,
          combination_role: pathway.combinationRole,
          compatible_roles: pathway.compatibleRoles,
          score: pathway.score,
          source: pathway.source,
        }))
      : [],
    selection_profiles: pathwayMapping
      ? healthKrSelectionProfiles(record, pathwayMapping)
      : [],
    indication_summary: compactClinicalText(official.efficacy),
    dosage_summary: compactClinicalText(official.dosage),
    precaution_summary: compactClinicalText(official.precautions),
    medication_guide: compactClinicalText(
      official.consumerGuidance.medicationGuide ??
        official.consumerGuidance.guide,
      600,
    ),
    classification_code: official.classification.code ?? "",
    atc_code: official.classification.atcCode ?? "",
    kpic_atc: official.classification.kpicAtc ?? "",
    storage: official.storage ?? "",
    valid_term: official.validTerm ?? "",
    insurance: official.insurance.status ?? "",
    interactions: healthKrInteractionTerms(official),
    same_ingredient_products: official.sameIngredientProducts
      .map((candidate) => candidate.productName)
      .filter(Boolean),
    permit_cancelled: false,
  };
};
const therapeuticIngredientMappings = (record, pathwayMapping) => {
  if (pathwayMapping.ingredientMappings.length === 1)
    return pathwayMapping.ingredientMappings;
  const identity = createHash("sha256")
    .update(record.officialProduct.productKey)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return [
    {
      sourceText: `${record.officialProduct.itemName} 복합성분`,
      ingredientId: `ING-FORMULA-${identity}`,
      identitySource: "official_product_composition",
    },
  ];
};
for (const record of healthKrImportedRecords) {
  const official = record.officialProduct;
  const pathwayMapping = clinicalPathwayByRegistryRecordId.get(
    record.registryRecordId,
  );
  if (
    !official ||
    !pathwayMapping ||
    pathwayMapping.mappingStatus !== "direct" ||
    record.officialMatch.status !== "confirmed" ||
    official.otcStatus !== "otc" ||
    official.permit.cancelled ||
    record.officialMatch.evidence.conflicts.length > 0 ||
    pathwayMapping.ingredientMappings.some((mapping) => !mapping.ingredientId)
  )
    throw new Error(
      `Ineligible Health.kr product escaped the registry gate: ${record.registryRecordId}`,
    );
  const sourceRef = healthKrSourceRef(record);
  const activeIngredients = pathwayMapping.ingredientMappings.map(
    (mapping) => ({
      ingredient_id: mapping.ingredientId,
      name: mapping.sourceText,
      strength_text: mapping.sourceText,
      normalized_amount: null,
      normalized_unit: null,
    }),
  );
  healthKrProducts.push({
    product_id: pathwayMapping.productId,
    display_name: record.retailOffer.displayName,
    ...healthKrProductMetadata(record, pathwayMapping),
    jurisdiction: "KR",
    item_seq: official.itemSeq,
    permit_number: null,
    product_code: null,
    otc_status: "otc",
    permit_status: "active",
    supply_performance: false,
    active_ingredients: activeIngredients,
    protocol_ids: pathwayMapping.pathways.map((pathway) => pathway.protocolId),
    status: "active",
    source_snapshot_ids: [healthKrSnapshotId],
    source_refs: [sourceRef],
    dur_flags: healthKrDurFlags(official),
  });
  for (const mapping of therapeuticIngredientMappings(record, pathwayMapping))
    healthKrProductIngredients.push({
      product_ingredient_id: `PRI-${pathwayMapping.productId.replace(/^PRD-/u, "")}-${mapping.ingredientId.replace(/^ING-/u, "")}`,
      product_id: pathwayMapping.productId,
      ingredient_id: mapping.ingredientId,
      strength_text: mapping.sourceText,
      normalized_amount: null,
      normalized_unit: null,
      role: "active",
      is_active: true,
      source_refs: [sourceRef],
    });
}

const normalizedProductIdentity = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/gu, "");
const normalizedManufacturer = (value) =>
  normalizedProductIdentity(
    String(value ?? "").replace(/\(주\)|㈜|주식회사/gu, ""),
  );
const normalizedIngredientIdentity = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\bpeg\b/gu, "폴리에틸렌글리콜")
    .replace(/[^0-9a-z가-힣]/gu, "");
const sourceIngredientName = (value) => {
  const text = String(value ?? "")
    .normalize("NFKC")
    .trim();
  const koreanIndex = text.search(/[가-힣]/u);
  return (koreanIndex >= 0 ? text.slice(koreanIndex) : text)
    .replace(/\s+\d[\s\S]*$/u, "")
    .trim();
};
const generatedReview = {
  expires_at: "2027-01-13T00:00:00+09:00",
  notes:
    "공식 품목 성분·효능과 약국 실습자료의 증상 경로를 연결한 연구 미리보기 후보. 약사 승인 전 운영 추천 금지.",
  official_source_verified: true,
  pharmacist_approved: false,
  reviewed_at: null,
  reviewer_ids: [],
};
const existingIngredientIds = new Set(
  ingredients.map((item) => item.ingredient_id),
);
const existingOptionByProtocolIngredient = new Map(
  protocolOptions.map((option) => [
    `${option.protocol_id}|${option.ingredient_id}`,
    option,
  ]),
);
const generatedIngredientById = new Map();
const generatedOptionGroups = new Map();
for (const record of healthKrImportedRecords) {
  const mapping = clinicalPathwayByRegistryRecordId.get(
    record.registryRecordId,
  );
  const sourceRef = healthKrSourceRef(record);
  // 복합제는 치료 단위로 ING-FORMULA 하나에 묶인다. 그건 옵션을 만드는
  // 방식이고 그대로 둔다. 다만 제품은 개별 성분 id 를 그대로 참조하므로,
  // 그 id 들도 이름을 가져야 한다. 여기서 등록하는 것은 이름뿐이고 옵션도
  // 주장도 늘지 않는다. 이름이 없으면 성분을 훑는 검사가 빈 문자열을 보고
  // 조용히 통과한다.
  for (const ingredient of mapping?.ingredientMappings ?? [])
    if (
      ingredient.ingredientId &&
      !existingIngredientIds.has(ingredient.ingredientId) &&
      !generatedIngredientById.has(ingredient.ingredientId)
    ) {
      const displayName = sourceIngredientName(ingredient.sourceText);
      if (displayName)
        generatedIngredientById.set(ingredient.ingredientId, {
          ingredient_id: ingredient.ingredientId,
          display_name_ko: displayName,
          display_name_en: displayName,
          normalized_name: normalizedIngredientIdentity(displayName),
          mfds_ingredient_code: null,
          status: "active",
          source_snapshot_ids: [healthKrSnapshotId],
          source_refs: [
            {
              ...sourceRef,
              claim_id: `REG-ING-${ingredient.ingredientId.replace(/^ING-/u, "")}`,
            },
          ],
          review: generatedReview,
        });
    }
  for (const ingredient of therapeuticIngredientMappings(record, mapping)) {
    if (
      !existingIngredientIds.has(ingredient.ingredientId) &&
      !generatedIngredientById.has(ingredient.ingredientId)
    ) {
      const displayName = sourceIngredientName(ingredient.sourceText);
      generatedIngredientById.set(ingredient.ingredientId, {
        ingredient_id: ingredient.ingredientId,
        display_name_ko: displayName,
        display_name_en: displayName,
        normalized_name: normalizedIngredientIdentity(displayName),
        mfds_ingredient_code: null,
        status: "active",
        source_snapshot_ids: [healthKrSnapshotId],
        source_refs: [
          {
            ...sourceRef,
            claim_id: `REG-ING-${ingredient.ingredientId.replace(/^ING-/u, "")}`,
          },
        ],
        review: generatedReview,
      });
    }
    for (const pathway of mapping.pathways) {
      const key = `${pathway.protocolId}|${ingredient.ingredientId}`;
      if (existingOptionByProtocolIngredient.has(key)) continue;
      const current = generatedOptionGroups.get(key) ?? {
        protocolId: pathway.protocolId,
        ingredientId: ingredient.ingredientId,
        displayName: sourceIngredientName(ingredient.sourceText),
        productIds: new Set(),
        sourceRefs: [],
        mechanisms: new Set(),
        combinationRoles: new Set(),
        compatibleRoles: new Set(),
        score: 0,
      };
      current.productIds.add(mapping.productId);
      current.sourceRefs.push(sourceRef);
      for (const mechanism of pathway.mechanisms)
        current.mechanisms.add(mechanism);
      if (pathway.combinationRole)
        current.combinationRoles.add(pathway.combinationRole);
      for (const role of pathway.compatibleRoles ?? [])
        current.compatibleRoles.add(role);
      current.score = Math.max(current.score, pathway.score);
      generatedOptionGroups.set(key, current);
    }
  }
}
// 자리표시자로 남은 성분을 허가 라벨에 적힌 이름으로 등록한다. 이름이
// 없어서 미등록이었던 게 아니라, 라벨 원문과 등록명의 글자가 달라 대조에
// 실패했을 뿐이다. 등록되지 않은 성분은 성분을 훑는 검사가 빈 문자열을
// 보고 조용히 통과하는 구멍이 되므로 남겨두지 않는다.
for (const seed of unmappedIngredientSeeds) {
  if (
    existingIngredientIds.has(seed.ingredientId) ||
    generatedIngredientById.has(seed.ingredientId)
  )
    continue;
  const displayName = sourceIngredientName(seed.rawName);
  if (!displayName) continue;
  generatedIngredientById.set(seed.ingredientId, {
    ingredient_id: seed.ingredientId,
    display_name_ko: displayName,
    display_name_en: displayName,
    normalized_name: normalizedIngredientIdentity(displayName),
    mfds_ingredient_code: null,
    status: "active",
    source_snapshot_ids: [seed.snapshotId],
    source_refs: [
      {
        ...seed.ref,
        claim_id: `REG-ING-${seed.ingredientId.replace(/^ING-/u, "")}`,
      },
    ],
    review: generatedReview,
  });
}

const generatedIngredients = [...generatedIngredientById.values()];
const generatedProtocolOptions = [];
const generatedClaims = [];
for (const group of generatedOptionGroups.values()) {
  const protocolTemplate = allProtocolTemplates.find(
    (protocol) => protocol.protocol_id === group.protocolId,
  );
  const optionTemplate = protocolOptions.find(
    (option) => option.protocol_id === group.protocolId,
  );
  if (!protocolTemplate)
    throw new Error(
      `Clinical pathway protocol is missing: ${group.protocolId}`,
    );
  const suffix = `${group.protocolId.replace(/^PTC-/u, "")}-${group.ingredientId.replace(/^ING-/u, "")}`;
  const protocolSuffix = group.protocolId.replace(/^PTC-/u, "");
  const optionId = `OPT-PATHWAY-${suffix}`;
  const claimId = `CLM-PATHWAY-${suffix}-INDICATION`;
  const supportive =
    group.combinationRoles.size > 0 &&
    [...group.combinationRoles].every((role) => role === "supportive");
  const sourceRefs = group.sourceRefs.filter(
    (sourceRef, index, all) =>
      all.findIndex((candidate) => candidate.locator === sourceRef.locator) ===
      index,
  );
  generatedProtocolOptions.push({
    option_id: optionId,
    protocol_id: group.protocolId,
    ingredient_id: group.ingredientId,
    display_name: group.displayName,
    eligibility_rule_ids: optionTemplate?.eligibility_rule_ids ?? [
      `RUL-${protocolSuffix}-SELECT-FALLBACK`,
    ],
    exclusion_rule_ids: optionTemplate?.exclusion_rule_ids ?? [
      `RUL-${protocolSuffix}-REFER-RED-FLAGS`,
    ],
    claim_ids: [claimId],
    clinical_priority: Math.min(99, Math.max(50, group.score)),
    // Newly expanded options have official product safety text, but they have
    // not received the same structured pharmacist review as curated options.
    // Keep them behind curated options until that review is complete.
    safety_priority: 1,
    therapeutic_role: "alternative",
    evidence_scope: supportive ? "supportive" : "direct",
    fit_rationale:
      "공식 품목 효능·효과와 투여경로가 증상 경로에 직접 일치합니다.",
    pathway_mechanisms: [...group.mechanisms],
    combination_roles: [...group.combinationRoles],
    compatible_roles: [...group.compatibleRoles],
    status: "candidate",
    source_refs: sourceRefs.map((sourceRef) => ({
      ...sourceRef,
      claim_id: optionId,
    })),
    review: generatedReview,
  });
  generatedClaims.push({
    claim_id: claimId,
    claim_type: "indication",
    subject_type: "option",
    subject_id: optionId,
    predicate: "candidate_for_symptom",
    object: {
      candidate_product_ids: [...group.productIds],
      candidate_product_names: [],
      ingredient_id: group.ingredientId,
      symptom_category: protocolTemplate.symptom_category,
      inventory_gate: true,
      tenant_formulary_gate: true,
      selection_basis:
        "공식 효능·효과, 성분, 제형, 투여경로를 모두 확인한 연구 미리보기 후보",
      rationale:
        "공식 품목 효능·효과와 약국 실습자료에서 정리한 증상별 사용 경로가 일치",
    },
    qualifiers: { protocol_id: group.protocolId },
    risk_level: "moderate",
    conflict_claim_ids: [],
    pack_id: "PACK-PHARMASSIST-KR-OTC-ACTUAL-20260713",
    status: "candidate",
    source_refs: sourceRefs.map((sourceRef) => ({
      ...sourceRef,
      claim_id: claimId,
    })),
    review: generatedReview,
  });
}
const extensionProtocolRules = extensionProtocols.flatMap((protocol) => {
  const definition = fieldPracticeProtocols.protocols.find(
    (item) => item.protocolId === protocol.protocol_id,
  );
  const optionIds = generatedProtocolOptions
    .filter((option) => option.protocol_id === protocol.protocol_id)
    .map((option) => option.option_id);
  // A protocol marked no_registered_product carries zero options by design:
  // the official registry has no product for it. That is the one case where an
  // empty option set is expected rather than a build defect.
  const noRegisteredProduct =
    definition?.activationStatus === "no_registered_product";
  if (!definition || (optionIds.length === 0 && !noRegisteredProduct))
    throw new Error(
      `Field-practice protocol has no official product candidates: ${protocol.protocol_id}`,
    );
  if (noRegisteredProduct && optionIds.length > 0)
    throw new Error(
      `Protocol is marked no_registered_product but has official candidates: ${protocol.protocol_id}`,
    );
  const suffix = protocol.protocol_id.replace(/^PTC-/u, "");
  const referRuleId = `RUL-${suffix}-REFER-RED-FLAGS`;
  const selectRuleId = `RUL-${suffix}-SELECT-FALLBACK`;
  const referRule = {
    rule_id: referRuleId,
    protocol_id: protocol.protocol_id,
    kind: "referral_pattern",
    effect: "refer",
    field: "normalized_text",
    operator: "matches",
    value: definition.negative,
    option_ids: [],
    question: null,
    reason:
      "현장실습 자료의 의뢰 신호가 있으면 제품 후보를 비우고 진료를 우선합니다.",
    priority: 100,
    status: "candidate",
    review: protocol.review,
    source_refs: [
      fieldPracticeProtocolSourceRef(
        protocol.protocol_id,
        definition.page,
        referRuleId,
      ),
    ],
  };
  // No registered product means nothing to select. Emitting only the refer
  // rule keeps the protocol retrievable for red-flag screening while the
  // decision path yields zero candidates.
  if (noRegisteredProduct) return [referRule];
  const selectRule = {
    rule_id: selectRuleId,
    protocol_id: protocol.protocol_id,
    kind: "selection_pattern",
    effect: "select",
    field: "triage.red_flags_absent_and_minimum_safety_known",
    operator: "equals",
    value: true,
    option_ids: optionIds,
    question: null,
    reason:
      "위험 신호가 없을 때 공식 효능과 제품별 현장 선택 기준이 있는 후보만 제공합니다.",
    priority: 70,
    status: "candidate",
    review: protocol.review,
    source_refs: [
      fieldPracticeProtocolSourceRef(
        protocol.protocol_id,
        definition.page,
        selectRuleId,
      ),
    ],
  };
  return [referRule, selectRule];
});
const packComposition = (product) =>
  new Set(
    (product.active_ingredients ?? []).map((ingredient) =>
      String(ingredient.ingredient_id).startsWith("ING-UNMAPPED_")
        ? `name:${normalizedIngredientIdentity(ingredient.name)}`
        : `id:${ingredient.ingredient_id}`,
    ),
  );
const officialComposition = (record) =>
  new Set(
    record.officialProduct.activeIngredients.map((ingredient) =>
      ingredient.ingredientId
        ? `id:${ingredient.ingredientId}`
        : `name:${normalizedIngredientIdentity(
            sourceIngredientName(ingredient.sourceText),
          )}`,
    ),
  );
const exactSet = (left, right) =>
  left.size > 0 &&
  left.size === right.size &&
  [...left].every((value) => right.has(value));
if (
  healthKrProductCrosswalk.schemaVersion !== "1.0.0" ||
  !Array.isArray(healthKrProductCrosswalk.entries)
)
  throw new Error("Health.kr legacy product crosswalk is invalid");
const crosswalkByProductId = new Map();
for (const entry of healthKrProductCrosswalk.entries) {
  if (
    !entry.productId ||
    !entry.officialProductKey ||
    crosswalkByProductId.has(entry.productId)
  )
    throw new Error("Health.kr legacy product crosswalk has invalid entries");
  crosswalkByProductId.set(entry.productId, entry.officialProductKey);
}
const confirmedOverlayRecords = healthKrRegistry.records.filter(
  (record) =>
    record.officialMatch.status === "confirmed" &&
    record.officialProduct &&
    !record.officialProduct.permit.cancelled &&
    record.officialMatch.evidence.conflicts.length === 0,
);
const overlayRecordsFor = (product) => {
  const officialProductKey = crosswalkByProductId.get(product.product_id);
  if (!officialProductKey) return [];
  const productName = normalizedProductIdentity(product.display_name);
  const manufacturer = normalizedManufacturer(product.manufacturer);
  const composition = packComposition(product);
  return confirmedOverlayRecords
    .filter((record) => {
      const official = record.officialProduct;
      if (official.productKey !== officialProductKey) return false;
      const exactName = [
        record.retailOffer.displayName,
        official.itemName,
      ].some((name) => normalizedProductIdentity(name) === productName);
      const exactManufacturer =
        manufacturer &&
        normalizedManufacturer(official.manufacturer) === manufacturer;
      const exactIngredientJoin = exactSet(
        composition,
        officialComposition(record),
      );
      return exactName && exactManufacturer && exactIngredientJoin;
    })
    .sort(
      (left, right) =>
        left.retailOffer.displayedPriceKrw -
          right.retailOffer.displayedPriceKrw ||
        left.retailOffer.skuId.localeCompare(right.retailOffer.skuId),
    );
};
const legacyMatchRecords = legacyProducts.map((product) => {
  const mappedKey = crosswalkByProductId.get(product.product_id) ?? null;
  const records = overlayRecordsFor(product);
  const signatures = new Set(
    records.map((record) =>
      JSON.stringify({
        itemName: record.officialProduct.itemName,
        manufacturer: record.officialProduct.manufacturer,
        composition: [...officialComposition(record)].sort(),
      }),
    ),
  );
  const status =
    records.length === 0
      ? "failed"
      : signatures.size === 1
        ? "matched"
        : "ambiguous";
  return {
    productId: product.product_id,
    displayName: product.display_name,
    officialProductKey: mappedKey,
    status,
    retailSkuCount: status === "matched" ? records.length : 0,
    reason:
      status === "matched"
        ? "audited crosswalk, exact name, manufacturer, and complete active composition"
        : mappedKey
          ? "crosswalk target failed exact identity or complete composition validation"
          : "no audited official product crosswalk",
  };
});
const invalidCrosswalkMatches = legacyMatchRecords.filter(
  (record) => record.officialProductKey && record.status !== "matched",
);
if (invalidCrosswalkMatches.length > 0)
  throw new Error(
    `Health.kr crosswalk failed complete identity validation: ${invalidCrosswalkMatches
      .map((record) => record.productId)
      .join(", ")}`,
  );
if (
  healthKrProductCrosswalk.entries.some(
    (entry) =>
      !legacyProducts.some((product) => product.product_id === entry.productId),
  )
)
  throw new Error("Health.kr crosswalk references an unknown legacy product");
const overlayRecordFor = (product) => {
  const records = overlayRecordsFor(product);
  const signatures = new Set(
    records.map((record) =>
      JSON.stringify({
        itemName: record.officialProduct.itemName,
        manufacturer: record.officialProduct.manufacturer,
        composition: [...officialComposition(record)].sort(),
      }),
    ),
  );
  return signatures.size === 1 ? records[0] : undefined;
};
const healthKrEnrichmentProductIds = new Set(
  enrichmentIndex
    .filter((item) => item.healthkr_url.includes("/result_drug.asp"))
    .map((item) => item.product_id),
);
const explicitlyClaimedProtocolIdsFor = (productId) =>
  new Set(
    claims.flatMap((claim) => {
      if (
        claim.claim_type !== "indication" ||
        typeof claim.object !== "object" ||
        claim.object === null ||
        Array.isArray(claim.object) ||
        !claim.object.candidate_product_ids?.includes(productId)
      )
        return [];
      const protocolId = claim.qualifiers?.protocol_id;
      return typeof protocolId === "string" ? [protocolId] : [];
    }),
  );
const legacySelectionProfilesFor = (product) => {
  const directlyMappedProtocolIds = directProtocolIdsByItemSeq.get(
    product.item_seq,
  );
  const explicitlyClaimedProtocolIds = explicitlyClaimedProtocolIdsFor(
    product.product_id,
  );
  const allowedLegacyProtocolIds =
    legacyProtocolAllowlistByProductId.get(product.product_id) ?? new Set();
  const ingredientIds = new Set(
    [...productIngredients, ...newProductIngredients]
      .filter(
        (link) =>
          link.product_id === product.product_id &&
          link.is_active &&
          link.role !== "excipient",
      )
      .map((link) => link.ingredient_id),
  );
  const protocolIds = new Set(explicitlyClaimedProtocolIds);
  for (const option of protocolOptions)
    if (ingredientIds.has(option.ingredient_id))
      protocolIds.add(option.protocol_id);
  return [...protocolIds].flatMap((protocolId) => {
    if (
      directlyMappedProtocolIds &&
      !directlyMappedProtocolIds.has(protocolId) &&
      !allowedLegacyProtocolIds.has(protocolId)
    )
      return [];
    const pathway = clinicalPathwayByProtocolId.get(protocolId);
    if (!pathway) return [];
    const activeIngredientText = (product.active_ingredients ?? [])
      .map((ingredient) => ingredient.name)
      .join(" ");
    if (
      (pathway.activeIngredientNone ?? []).some((term) =>
        selectionEvidenceIdentity(activeIngredientText).includes(
          selectionEvidenceIdentity(term),
        ),
      )
    )
      return [];
    const fitScore = Math.max(
      pathway.priority ?? 0,
      ...protocolOptions
        .filter(
          (option) =>
            option.protocol_id === protocolId &&
            ingredientIds.has(option.ingredient_id),
        )
        .map((option) => option.clinical_priority),
    );
    const ingredients = (product.active_ingredients ?? [])
      .map((ingredient) => ingredientSelectionLabel(ingredient.name))
      .filter(Boolean)
      .slice(0, 3);
    const form = [product.dosage_form, product.route]
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(" · ");
    const supportive = pathway.combinationRole === "supportive";
    const mechanisms = evidenceMechanismsFor(pathway, [
      product.display_name,
      product.dosage_form,
      product.route,
      ...(product.active_ingredients ?? []).map(
        (ingredient) => ingredient.name,
      ),
    ]);
    // The gate stops a card being written for a product whose only link is a
    // word matching in its indication text. A curated claim naming this exact
    // product for this exact protocol is not that: a person decided it, and
    // the claim is what creates the option the engine offers. Suppressing the
    // card there left 게보린브이정 displayed as a joint-pain candidate with no
    // guidance on it at all, which is worse than either answer alone.
    if (
      pathway.requireMechanismEvidence === true &&
      mechanisms.includes("official_indication_match") &&
      !explicitlyClaimedProtocolIds.has(protocolId)
    )
      return [];
    const population = dosagePopulationLabel("", product.display_name);
    return [
      {
        protocol_id: protocolId,
        fit_score: Math.min(100, Math.max(0, fitScore)),
        choose_when: contextualSelectionGuidance({
          protocolId,
          mechanisms,
          productName: product.display_name,
          ingredients,
          ingredientEvidence: (product.active_ingredients ?? []).map(
            (ingredient) => ingredient.name,
          ),
          dosageForm: product.dosage_form,
          route: product.route,
        }),
        differentiators: [
          ingredients.length > 0
            ? `주요 성분: ${ingredients.join(", ")}`
            : null,
          form ? `제형·투여경로: ${form}` : null,
          population ? `복용 대상: ${population}` : null,
          supportive
            ? "주증상 치료를 대신하기보다 보조 역할로 검토"
            : "현재 증상 경로에서 직접 작용하는 1차 역할로 검토",
        ].filter(Boolean),
        comparison_note: supportive
          ? "직접 치료형 후보와 같은 순위로 보지 않고 보조 후보로 구분합니다."
          : "같은 증상 후보 중 성분 기전과 제형이 현재 불편에 더 직접 맞을 때 우선합니다.",
        practical_points: [],
        evidence_source: pathway.source,
      },
    ];
  });
};
const localIndicationPatch = (product) => {
  const entry = mfdsIndicationByItemSeq.get(String(product.item_seq));
  if (
    product.indication_summary ||
    !entry?.indicationSummary ||
    !entry.source_ref
  )
    return {};
  return {
    indication_summary: entry.indicationSummary,
    source_snapshot_ids: [
      ...(product.source_snapshot_ids ?? []),
      entry.source_snapshot_id,
    ].filter(Boolean),
    source_refs: [...(product.source_refs ?? []), entry.source_ref],
  };
};
const productsWithHealthKrOverlays = [...products, ...newProducts].map(
  (product) => {
    const record = overlayRecordFor(product);
    // A legacy product with neither a HealthKR record nor enrichment used to
    // fall through with no profiles at all, while its options still put it in
    // front of a pharmacist — 아이투오미니점안액 was the top dry-eye candidate
    // with no guidance text on the card. The profiles come from the same
    // function either way; only the enrichment check gated the call.
    if (!record)
      return {
        ...product,
        ...localIndicationPatch(product),
        selection_profiles: legacySelectionProfilesFor(product),
      };
    const sourceRef = healthKrSourceRef(record);
    const durFlags = [
      ...(product.dur_flags ?? []),
      ...healthKrDurFlags(record.officialProduct),
    ].filter(
      (flag, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.type === flag.type &&
            candidate.code === flag.code &&
            candidate.description === flag.description,
        ) === index,
    );
    const officialMetadata = healthKrProductMetadata(
      record,
      clinicalPathwayByRegistryRecordId.get(record.registryRecordId),
    );
    const officialSelectionProfiles = officialMetadata.selection_profiles;
    const allowedLegacyProtocolIds =
      legacyProtocolAllowlistByProductId.get(product.product_id) ?? new Set();
    const explicitLegacySelectionProfiles = legacySelectionProfilesFor(
      product,
    ).filter((profile) => allowedLegacyProtocolIds.has(profile.protocol_id));
    const mergedSelectionProfiles = [
      ...officialSelectionProfiles,
      ...explicitLegacySelectionProfiles.filter(
        (legacyProfile) =>
          !officialSelectionProfiles.some(
            (officialProfile) =>
              officialProfile.protocol_id === legacyProfile.protocol_id,
          ),
      ),
    ];
    return {
      ...product,
      ...localIndicationPatch(product),
      ...officialMetadata,
      // A confirmed official mapping is the protocol source of truth. Reusing
      // profiles inferred from any shared ingredient reintroduced cold
      // combinations into headache and menstrual-pain protocols, and vitamin
      // combinations into primary musculoskeletal protocols.
      selection_profiles: mergedSelectionProfiles,
      source_snapshot_ids: [
        ...new Set([...product.source_snapshot_ids, healthKrSnapshotId]),
      ],
      source_refs: [...product.source_refs, sourceRef],
      dur_flags: durFlags,
    };
  },
);

const runtimeSources = [
  ...sources,
  ...newSources,
  ...mfdsIngredientSources,
].filter(
  (sourceItem, index, all) =>
    all.findIndex(
      (candidate) =>
        candidate.source_snapshot_id === sourceItem.source_snapshot_id,
    ) === index,
);
const fieldPracticeApplications = [];
// The generated pipeline gave every profile the same comparison note — "성분
// 기전과 제형이 현재 불편에 더 직접 맞을 때 우선합니다" — which is circular and
// told the pharmacist nothing about which candidate to pick. These replace it
// with an actual contrast against the protocol's other candidates, and drop the
// engine phrase that leaked into the differentiator list. Curated text, so it
// is refereed the same way a composed line is: no dose, no engine vocabulary,
// no product the pack does not carry.
// Both lists: the pathway expansion adds the health.kr ingredients that most of
// these notes are written against, and they only exist in generatedIngredients.
const ingredientIdByDisplayName = new Map();
for (const item of [
  ...ingredients,
  ...generatedIngredients,
  ...mfdsRegisteredIngredients,
]) {
  const name = item.display_name_ko;
  if (ingredientIdByDisplayName.has(name))
    ingredientIdByDisplayName.set(name, "AMBIGUOUS");
  else ingredientIdByDisplayName.set(name, item.ingredient_id);
}
const emptyComparisonNote =
  "성분 기전과 제형이 현재 불편에 더 직접 맞을 때 우선합니다.";
const engineVocabulary =
  /지식팩|데이터베이스|스키마|슬롯|프로토콜|규칙\s*id|엔진|옵션|option|rule_id|1차 역할로 검토/iu;
const dosageText = /\d+\s*(?:mg|g|mL|ml|정|알|캡슐|포|회|일)\b|하루\s*\d+/iu;
const selectionCopyByKey = new Map();
if (
  selectionCopy.schemaVersion !== "1.0.0" ||
  !Array.isArray(selectionCopy.entries)
)
  throw new Error("selection-copy.json is invalid");
for (const entry of selectionCopy.entries) {
  const note = entry.comparisonNote;
  if (typeof note !== "string" || note.length === 0 || note.length > 140)
    throw new Error(
      `Selection copy note is missing or too long: ${entry.protocolId}/${entry.ingredient}`,
    );
  if (note === emptyComparisonNote)
    throw new Error(
      `Selection copy repeats the empty note: ${entry.protocolId}/${entry.ingredient}`,
    );
  if (engineVocabulary.test(note))
    throw new Error(
      `Selection copy uses engine vocabulary: ${entry.protocolId}/${entry.ingredient}`,
    );
  if (dosageText.test(note))
    throw new Error(
      `Selection copy states a dose: ${entry.protocolId}/${entry.ingredient}`,
    );
  let key = entry.ingredient;
  if (key !== "COMBO") {
    const resolved = ingredientIdByDisplayName.get(entry.ingredient);
    if (!resolved || resolved === "AMBIGUOUS")
      throw new Error(
        `Selection copy names an unknown or ambiguous ingredient: ${entry.ingredient}`,
      );
    key = resolved;
  }
  // A protocol whose candidates are all combination products lands them in one
  // ingredient group, so an ingredient-keyed note would say the same thing for
  // all of them. Such an entry may narrow on the choose_when cluster instead,
  // and the narrower entry wins.
  const mapKey = `${entry.protocolId}|${key}|${entry.chooseWhenContains ?? ""}`;
  if (selectionCopyByKey.has(mapKey))
    throw new Error(`Duplicate selection copy entry: ${mapKey}`);
  selectionCopyByKey.set(mapKey, {
    note,
    // The generated choose_when is derived from the pathway's mechanisms, so a
    // product that reaches a protocol through a curated claim rather than a
    // mechanism gets the pathway's generic wording — which said acetaminophen
    // supplies 소염진통 for joint pain. It does not. An entry may replace that
    // sentence as well as the note.
    chooseWhen: typeof entry.chooseWhen === "string" ? entry.chooseWhen : null,
    used: false,
    protocolId: entry.protocolId,
    ingredientKey: key,
    chooseWhenContains: entry.chooseWhenContains ?? null,
  });
}
const selectionCopyFor = (product, profile) => {
  const active = (product.active_ingredients ?? []).map(
    (item) => item.ingredient_id,
  );
  const ingredientKey = active.length === 1 ? active[0] : "COMBO";
  const candidates = [...selectionCopyByKey.values()].filter(
    (entry) =>
      entry.protocolId === profile.protocol_id &&
      entry.ingredientKey === ingredientKey &&
      (entry.chooseWhenContains === null ||
        (profile.choose_when ?? "").includes(entry.chooseWhenContains)),
  );
  // Longest cluster match first, so the specific note beats the general one.
  candidates.sort(
    (left, right) =>
      (right.chooseWhenContains?.length ?? 0) -
      (left.chooseWhenContains?.length ?? 0),
  );
  return candidates[0];
};

const runtimeProducts = [
  ...productsWithHealthKrOverlays,
  ...healthKrProducts,
].map((product) => {
  const deniedProtocolIds =
    deniedProtocolIdsByProductId.get(product.product_id) ?? new Set();
  const selectionProfiles = (product.selection_profiles ?? [])
    .filter((profile) => !deniedProtocolIds.has(profile.protocol_id))
    .map((profile) => {
      const matchingRules = fieldPracticeGuidance.profiles.filter(
        (rule) =>
          rule.protocolIds.includes(profile.protocol_id) &&
          rule.productNameAny.some((name) =>
            normalizedProductIdentity(product.display_name).includes(
              normalizedProductIdentity(name),
            ),
          ),
      );
      if (matchingRules.length > 1)
        throw new Error(
          `Ambiguous field-practice guidance: ${product.display_name} ${profile.protocol_id}`,
        );
      const rule = matchingRules[0];
      if (!rule) {
        // Field-practice wording wins where it exists; this only fills the
        // profiles the pipeline left with the circular note.
        const copy = selectionCopyFor(product, profile);
        const differentiators = (profile.differentiators ?? []).filter(
          (text) => !/현재 증상 경로에서 직접 작용하는/.test(text),
        );
        if (!copy) return { ...profile, differentiators };
        copy.used = true;
        return {
          ...profile,
          differentiators,
          ...(copy.chooseWhen ? { choose_when: copy.chooseWhen } : {}),
          comparison_note: copy.note,
        };
      }
      fieldPracticeApplications.push({
        ruleId: rule.ruleId,
        productId: product.product_id,
        productName: product.display_name,
        protocolId: profile.protocol_id,
        page: rule.page,
      });
      const override = rule.byProtocol?.[profile.protocol_id] ?? {};
      return {
        ...profile,
        choose_when: override.chooseWhen ?? rule.chooseWhen,
        differentiators: override.differentiators ?? rule.differentiators,
        comparison_note: override.comparisonNote ?? rule.comparisonNote,
        practical_points: rule.practicalPoints,
        evidence_source: `${fieldPracticeGuidance.source.sourceId}#page=${rule.page}`,
      };
    });
  const applied = selectionProfiles.some(
    (profile, index) => profile !== (product.selection_profiles ?? [])[index],
  );
  if (!applied) return { ...product, selection_profiles: selectionProfiles };
  return {
    ...product,
    selection_profiles: selectionProfiles,
    source_snapshot_ids: [
      ...new Set([
        ...(product.source_snapshot_ids ?? []),
        fieldPracticeGuidance.source.sourceSnapshotId,
      ]),
    ],
    source_refs: [
      ...(product.source_refs ?? []),
      {
        claim_id: `FIELD-PRACTICE-${product.product_id}`,
        source_id: fieldPracticeGuidance.source.sourceId,
        source_snapshot_id: fieldPracticeGuidance.source.sourceSnapshotId,
        locator: `제품별 실무 선택 기준 (${[
          ...new Set(
            fieldPracticeApplications
              .filter((item) => item.productId === product.product_id)
              .map((item) => `p.${item.page}`),
          ),
        ].join(", ")})`,
        verified_at: fieldPracticeGuidance.source.fetchedAt,
      },
    ],
  };
});

// A curated note that matches no profile is a typo or wording the pack dropped.
const unusedSelectionCopy = [...selectionCopyByKey.entries()]
  .filter(([, value]) => !value.used)
  .map(([key]) => key);
if (unusedSelectionCopy.length > 0)
  throw new Error(
    `Selection copy matched no profile: ${unusedSelectionCopy.join(", ")}`,
  );
const runtimeProductIngredients = [
  ...productIngredients,
  ...newProductIngredients,
  ...healthKrProductIngredients,
];

if (intentSeeds.length !== 74 || aliasSeeds.length !== 222)
  throw new Error(
    `Unexpected dialogue seed counts: ${intentSeeds.length} intents, ${aliasSeeds.length} aliases`,
  );
const intentIds = new Set(intentSeeds.map((item) => item.intent_id));
const orphanAliases = aliasSeeds.filter(
  (item) => !intentIds.has(item.intent_id),
);
if (orphanAliases.length)
  throw new Error(`Orphan dialogue aliases: ${orphanAliases.length}`);
const aliasesByIntent = new Map();
for (const alias of aliasSeeds)
  aliasesByIntent.set(alias.intent_id, [
    ...(aliasesByIntent.get(alias.intent_id) ?? []),
    alias.phrase,
  ]);

for (const [intentId, copy] of Object.entries(dialogueCopies)) {
  if (!intentIds.has(intentId))
    throw new Error(`Dialogue copy intent missing: ${intentId}`);
  if (
    typeof copy?.say_now !== "string" ||
    typeof copy?.question !== "string" ||
    typeof copy?.slot !== "string" ||
    !copy.say_now.trim() ||
    !copy.question.trim() ||
    !copy.slot.trim()
  )
    throw new Error(`Invalid dialogue copy: ${intentId}`);
}

const dialogueCards = intentSeeds.map((intent) => {
  const dialogue = dialogueFor(intent, dialogueCopies);
  return {
    cardId: `CARD-SEED-${intent.intent_id.toUpperCase().replaceAll("_", "-")}`,
    intent: intent.intent_id,
    domain: "human_otc",
    title: intent.display_title,
    aliases: [...new Set(aliasesByIntent.get(intent.intent_id) ?? [])],
    keywords: [intent.category, intent.display_title],
    sayNow: [dialogue.sayNow],
    askNext: {
      question: dialogue.question,
      reason: "상담 방향을 정하는 데 필요한 한 가지 확인",
      priority: 1,
      slot: dialogue.slot,
    },
    avoid: [],
    approved: true,
    synthetic: true,
    expiresAt: "2027-01-13T00:00:00+09:00",
  };
});

// Pathway-expanded options are appended to each protocol later in this build,
// so an overlay pointing at one is valid even though the source template has
// not heard of it yet.
const generatedOptionIdsByProtocol = new Map();
for (const option of generatedProtocolOptions) {
  if (!generatedOptionIdsByProtocol.has(option.protocol_id))
    generatedOptionIdsByProtocol.set(option.protocol_id, new Set());
  generatedOptionIdsByProtocol.get(option.protocol_id).add(option.option_id);
}
const selectionOverlayRules = selectionOverlays.flatMap((overlay) => {
  // Field-practice protocols live in the extension set, so an overlay for one
  // has to resolve against both.
  const protocol = allProtocolTemplates.find(
    (item) => item.protocol_id === overlay.protocol_id,
  );
  if (!protocol)
    throw new Error(
      `Selection overlay protocol missing: ${overlay.protocol_id}`,
    );
  const optionIds = new Set([
    ...protocol.option_ids,
    ...(generatedOptionIdsByProtocol.get(overlay.protocol_id) ?? []),
  ]);
  for (const option of overlay.options)
    if (!optionIds.has(option.option_id))
      throw new Error(
        `Selection overlay option mismatch: ${overlay.protocol_id}/${option.option_id}`,
      );
  const baseReview = previewReview(protocol.review);
  const askRuleId =
    overlay.rule_id ?? `RUL-OVERLAY-${overlay.protocol_id}-ASK-PHENOTYPE`;
  const progressiveOnly = overlay.progressive_only === true;
  const placeholders = [
    ...overlay.question.matchAll(
      /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}|]+))?\}\}/gu,
    ),
  ];
  for (const placeholder of placeholders) {
    const slot = placeholder[1]?.trim();
    const fallback = placeholder[2]?.trim();
    const particle = placeholder[3]?.trim();
    if (
      !slot ||
      !fallback ||
      (particle && !["topic", "subject", "object", "with"].includes(particle))
    )
      throw new Error(
        `Invalid question template: ${overlay.protocol_id}/${overlay.field}`,
      );
  }
  if (
    progressiveOnly &&
    (!Array.isArray(overlay.answer_patterns) ||
      overlay.answer_patterns.length === 0)
  )
    throw new Error(
      `Progressive selection overlay needs answer patterns: ${overlay.protocol_id}/${overlay.field}`,
    );
  return [
    {
      rule_id: askRuleId,
      protocol_id: overlay.protocol_id,
      kind: "required_slot",
      effect: "ask",
      field: overlay.field,
      operator: "matches",
      value: progressiveOnly
        ? overlay.answer_patterns
        : overlay.options.flatMap((option) => option.patterns),
      // Two branches can land on the same option (a product that fits both
      // situations), which would repeat the id here.
      option_ids: progressiveOnly
        ? []
        : [...new Set(overlay.options.map((option) => option.option_id))],
      question: overlay.question,
      reason: overlay.reason,
      // Rules run in ascending priority and an unmatched ask short-circuits the
      // decision, so an ask below the referral rules asks its question instead
      // of referring. A situation question only narrows between candidates,
      // which is worth nothing once a red flag is present.
      priority: overlay.ask_priority ?? 1,
      ...(overlay.progressive ? { progressive: true } : {}),
      status: "published",
      review: baseReview,
      source_refs: protocol.source_refs,
    },
    ...(progressiveOnly ? [] : overlay.options).map((option, index) => ({
      // A protocol can carry both a curated overlay and a generated situation
      // overlay; without the discriminator both start at SELECT-1 and collide.
      rule_id: `RUL-OVERLAY-${overlay.protocol_id}${overlay.rule_suffix ?? ""}-SELECT-${index + 1}`,
      protocol_id: overlay.protocol_id,
      kind: "selection_pattern",
      effect: "select",
      field: overlay.field,
      operator: "matches",
      value: option.patterns,
      option_ids: [option.option_id],
      question: null,
      reason: `${overlay.reason} 입력된 증상 표현형과 일치하는 선택지만 유지합니다.`,
      priority: 2 + index,
      status: "published",
      review: baseReview,
      source_refs: protocol.source_refs,
    })),
  ];
});
if (
  therapeuticFit.candidate_only !== true ||
  therapeuticFit.clinical_use_prohibited !== true ||
  !Array.isArray(therapeuticFit.options)
)
  throw new Error("Therapeutic-fit preview gate or option list is invalid");

const sourceOptionIds = new Set(protocolOptions.map((item) => item.option_id));
const therapeuticFitByOptionId = new Map();
const therapeuticRoles = new Set(["preferred", "alternative", "conditional"]);
const evidenceScopes = new Set(["direct", "supportive", "phenotype_specific"]);
for (const fit of therapeuticFit.options) {
  if (!sourceOptionIds.has(fit.option_id))
    throw new Error(
      `Therapeutic fit references unknown option: ${fit.option_id}`,
    );
  if (therapeuticFitByOptionId.has(fit.option_id))
    throw new Error(`Therapeutic fit is duplicated: ${fit.option_id}`);
  if (
    !therapeuticRoles.has(fit.role) ||
    !evidenceScopes.has(fit.evidence_scope) ||
    typeof fit.rationale !== "string" ||
    fit.rationale.trim().length === 0
  )
    throw new Error(`Therapeutic fit is invalid: ${fit.option_id}`);
  therapeuticFitByOptionId.set(fit.option_id, fit);
}
const unclassifiedOptionIds = [...sourceOptionIds].filter(
  (optionId) => !therapeuticFitByOptionId.has(optionId),
);
if (unclassifiedOptionIds.length > 0)
  throw new Error(
    `Therapeutic fit is missing options: ${unclassifiedOptionIds.join(", ")}`,
  );

const patientFacingProtocolRules = protocolRules.filter(
  (rule) =>
    !(
      rule.effect === "ask" &&
      (rule.field === "patient.minimum_safety_information" ||
        rule.field === "triage.red_flags")
    ),
);
const previewProtocolRules = [
  ...patientFacingProtocolRules,
  ...selectionOverlayRules,
  ...extensionProtocolRules,
].filter(
  (rule) =>
    !(
      (rule.effect === "exclude" || rule.effect === "select") &&
      (rule.option_ids?.length ?? 0) === 0
    ),
);
const previewRuleIds = new Set(
  previewProtocolRules.map((item) => item.rule_id),
);
const applyProtocolDenylistToClaim = (claim) => {
  const protocolId = claim.qualifiers?.protocol_id;
  if (
    claim.claim_type !== "indication" ||
    typeof protocolId !== "string" ||
    typeof claim.object !== "object" ||
    claim.object === null ||
    Array.isArray(claim.object) ||
    !Array.isArray(claim.object.candidate_product_ids)
  )
    return claim;
  const keptIndexes = claim.object.candidate_product_ids.flatMap(
    (productId, index) =>
      deniedProtocolIdsByProductId.get(productId)?.has(protocolId)
        ? []
        : [index],
  );
  if (keptIndexes.length === claim.object.candidate_product_ids.length)
    return claim;
  return {
    ...claim,
    object: {
      ...claim.object,
      candidate_product_ids: keptIndexes.map(
        (index) => claim.object.candidate_product_ids[index],
      ),
      ...(Array.isArray(claim.object.candidate_product_names)
        ? {
            candidate_product_names: keptIndexes
              .map((index) => claim.object.candidate_product_names[index])
              .filter((name) => typeof name === "string"),
          }
        : {}),
    },
  };
};

// A comparison note that says "compare with X" is only actionable if X is on
// this protocol's list. X can be named three ways — an ingredient, a drug
// class, or a dosage form — and checking only the first let two of them
// through. Deliberate redirections are the exception: telling a pharmacist
// that ringworm needs an antifungal is the point of the sentence, not a
// dangling pointer, so those are declared rather than silently allowed.
const noteClassTerms = {
  스테로이드: ["트리암시놀론", "히드로코르티손", "프레드니솔론", "덱사메타손"],
  항히스타민: [
    "로라타딘",
    "세티리진",
    "펙소페나딘",
    "클로르페니라민",
    "디펜히드라민",
    "트리프롤리딘",
  ],
  제산: ["수산화마그네슘", "인산알루미늄", "탄산칼슘", "탄산수소나트륨"],
  소염진통: [
    "이부프로펜",
    "나프록센",
    "플루르비프로펜",
    "디클로페낙",
    "벤지다민",
    "덱시부프로펜",
  ],
  항진균: ["테르비나핀", "케토코나졸", "클로트리마졸"],
  점액용해: ["아세틸시스테인", "암브록솔", "브롬헥신"],
  거담: ["구아이페네신", "아세틸시스테인", "염화암모늄"],
  진해: ["덱스트로메토르판", "티페피딘", "노스카핀"],
  삼투성: ["수산화마그네슘", "산화마그네슘", "락툴로오스", "마크로골"],
  부피형성: ["차전자"],
  지사: ["로페라미드", "스멕타이트", "베르베린", "비스무트"],
};
// The vocabulary above is built from the pack, so it can only catch a name
// that exists somewhere else in the pack. A note naming a drug this registry
// does not stock at all — ambroxol, loperamide, a scopolamine patch — was
// invisible to it, which is the worse case: there is nowhere for the
// pharmacist to go. This list is deliberately independent of the pack.
const offPackDrugNames = [
  "암브록솔",
  "브롬헥신",
  "로페라미드",
  "락툴로오스",
  "마크로골",
  "폴리에틸렌글리콜",
  "라니티딘",
  "시메티딘",
  "오메프라졸",
  "란소프라졸",
  "에스오메프라졸",
  "스코폴라민",
  "아스피린",
  "록소프로펜",
  "노스카핀",
  "슈도에페드린",
  "옥시메타졸린",
  "나파졸린",
  "미코나졸",
  "무피로신",
  "겐타마이신",
];
const noteFormTerms = {
  트로키: ["트로키"],
  가글: ["가글"],
  스프레이: ["분무", "스프레이"],
  연고: ["연고"],
  크림: ["크림"],
  현탁액: ["현탁액"],
  점안: ["점안"],
  패치: ["패취", "경피"],
  좌제: ["좌제"],
};
const strippedIngredientName = (name) =>
  String(name ?? "")
    .replace(/[A-Za-z0-9 ().,/·%-]/gu, "")
    .trim();
const packIngredientVocabulary = new Set();
for (const product of runtimeProducts)
  for (const ingredient of product.active_ingredients ?? []) {
    const name = strippedIngredientName(ingredient.name);
    if (name.length < 3) continue;
    packIngredientVocabulary.add(name);
    const stem = name.replace(
      /(염산염|말레산염|시트르산염|브롬화수소산염)?(수화물|무수물)?$/u,
      "",
    );
    if (stem.length >= 3) packIngredientVocabulary.add(stem);
  }
const registeredIngredientNameById = new Map();
for (const ingredient of [
  ...ingredients,
  ...generatedIngredients,
  ...mfdsRegisteredIngredients,
])
  if (ingredient.display_name_ko) {
    // 두 글자 생약명은 일상어와 겹친다. 초과(Amomi Tsao-ko Fructus)와
    // 건강(말린 생강)이 실재하는 성분명이라, 부분일치로 검사하면 "5개를
    // 초과하지 마세요" 같은 문장이 성분 참조로 잡힌다. 짧은 이름은
    // 부분일치로 판정할 수 없으므로 어휘에서 뺀다. 성분 자체는 그대로
    // 등록되고, 이름을 못 쓰는 게 아니라 이 검사만 손대지 않는다.
    if (ingredient.display_name_ko.length >= 3)
      packIngredientVocabulary.add(ingredient.display_name_ko);
    registeredIngredientNameById.set(
      ingredient.ingredient_id,
      ingredient.display_name_ko,
    );
  }
for (const entry of fieldPracticeGuidance.offListReferences ?? [])
  if (
    typeof entry.protocolId !== "string" ||
    typeof entry.term !== "string" ||
    // An exemption without a stated reason is indistinguishable from someone
    // silencing the guard, which is the failure this whole check exists for.
    typeof entry.reason !== "string" ||
    entry.reason.length < 30
  )
    throw new Error(
      `Off-list reference needs a protocol, a term and a reason: ${entry.protocolId ?? "unknown"}`,
    );
const allowedOffListReference = new Set(
  (fieldPracticeGuidance.offListReferences ?? []).map(
    (entry) => `${entry.protocolId} :: ${entry.term}`,
  ),
);
// What the protocol can actually offer is the set of products the engine can
// reach through its options, not the smaller set that happens to carry card
// copy. Using the latter said acetaminophen was absent from PTC-JOINT_PAIN
// when OPT-JOINT_PAIN-ACETAMINOPHEN exists and 게보린브이정 answers to it —
// the pathway classifier excludes acetaminophen on mechanism, but a curated
// claim adds the option anyway, and the engine offers what the option offers.
const protocolOptionIngredientIds = new Map();
for (const option of [...protocolOptions, ...generatedProtocolOptions]) {
  if (!protocolOptionIngredientIds.has(option.protocol_id))
    protocolOptionIngredientIds.set(option.protocol_id, new Set());
  protocolOptionIngredientIds.get(option.protocol_id).add(option.ingredient_id);
}
const rosterTermsByProtocol = new Map();
const rosterEntryFor = (protocolId) => {
  if (!rosterTermsByProtocol.has(protocolId))
    rosterTermsByProtocol.set(protocolId, {
      ingredients: new Set(),
      forms: new Set(),
    });
  return rosterTermsByProtocol.get(protocolId);
};
for (const [protocolId, ingredientIds] of protocolOptionIngredientIds)
  for (const product of runtimeProducts) {
    if (
      !(product.active_ingredients ?? []).some((ingredient) =>
        ingredientIds.has(ingredient.ingredient_id),
      )
    )
      continue;
    const terms = rosterEntryFor(protocolId);
    terms.ingredients.add(product.display_name);
    for (const ingredient of product.active_ingredients ?? []) {
      terms.ingredients.add(strippedIngredientName(ingredient.name));
      terms.ingredients.add(ingredient.name ?? "");
      const registered = registeredIngredientNameById.get(
        ingredient.ingredient_id,
      );
      if (registered) terms.ingredients.add(registered);
    }
    if (product.dosage_form) terms.forms.add(product.dosage_form);
  }
for (const product of runtimeProducts)
  for (const profile of product.selection_profiles ?? []) {
    const terms = rosterEntryFor(profile.protocol_id);
    terms.ingredients.add(product.display_name);
    for (const ingredient of product.active_ingredients ?? []) {
      terms.ingredients.add(strippedIngredientName(ingredient.name));
      // The vocabulary takes registered names verbatim, so the roster has to
      // carry them verbatim too. Stripping only one side made a registered
      // name like 디아스타제·프로테아제·셀룰라제 look absent from the very
      // product that carries it.
      terms.ingredients.add(ingredient.name ?? "");
      const registered = registeredIngredientNameById.get(
        ingredient.ingredient_id,
      );
      if (registered) terms.ingredients.add(registered);
    }
    if (product.dosage_form) terms.forms.add(product.dosage_form);
  }
const usedOffListReference = new Set();
const danglingNoteReferences = [];
for (const product of runtimeProducts)
  for (const profile of product.selection_profiles ?? []) {
    // The card shows four fields, and checking only the comparison note left
    // the other three unguarded — the cetirizine differentiators kept naming
    // fexofenadine for a protocol that carries none long after the note
    // itself was fixed.
    const note = [
      profile.comparison_note ?? "",
      profile.choose_when ?? "",
      ...(profile.differentiators ?? []),
      ...(profile.practical_points ?? []),
    ].join(" ");
    if (!note.trim()) continue;
    const terms = rosterTermsByProtocol.get(profile.protocol_id);
    const ingredientText = [...terms.ingredients].join(" ");
    const formText = [...terms.forms].join(" ");
    const missing = [];
    for (const name of packIngredientVocabulary)
      if (note.includes(name) && !ingredientText.includes(name))
        missing.push(name);
    for (const name of offPackDrugNames)
      if (note.includes(name) && !ingredientText.includes(name))
        missing.push(name);
    for (const [word, members] of Object.entries(noteClassTerms))
      if (
        note.includes(word) &&
        !members.some((member) => ingredientText.includes(member))
      )
        missing.push(word);
    for (const [word, members] of Object.entries(noteFormTerms))
      if (
        note.includes(word) &&
        !members.some((member) => formText.includes(member))
      )
        missing.push(word);
    for (const term of new Set(missing)) {
      const key = `${profile.protocol_id} :: ${term}`;
      if (allowedOffListReference.has(key)) usedOffListReference.add(key);
      else danglingNoteReferences.push(key);
    }
  }
if (danglingNoteReferences.length)
  throw new Error(
    `Card notes point at candidates the protocol does not carry: ${[
      ...new Set(danglingNoteReferences),
    ].join(", ")}`,
  );
// An exemption for a case that no longer exists is the shape a real finding
// gets silenced by later. Make it fail while it is still obvious why.
const staleOffListReferences = [...allowedOffListReference].filter(
  (key) => !usedOffListReference.has(key),
);
if (staleOffListReferences.length)
  throw new Error(
    `Off-list references exempt a card that no longer says it: ${staleOffListReferences.join(", ")}`,
  );

// A profile can declare a protocol whose roster never carries the product, and
// nothing showed it: the report below counts a rule as applied if any one of
// its protocols matched. The declaration is not wrong on its own — the wording
// would apply if the roster ever gained the product — but it is an assumption
// about the candidate set, and an invisible assumption is the thing that made
// the famotidine note look reasonable for a protocol that has no famotidine.
const reachedRuleProtocols = new Set(
  fieldPracticeApplications.map(
    (item) => `${item.ruleId} :: ${item.protocolId}`,
  ),
);
const declaredUnreached = new Set();
for (const entry of fieldPracticeGuidance.unreachedProtocols ?? []) {
  if (
    typeof entry.ruleId !== "string" ||
    typeof entry.protocolId !== "string" ||
    typeof entry.reason !== "string" ||
    entry.reason.length < 30
  )
    throw new Error(
      `Unreached protocol needs a rule, a protocol and a reason: ${entry.ruleId ?? "unknown"}`,
    );
  declaredUnreached.add(`${entry.ruleId} :: ${entry.protocolId}`);
}
const undeclaredUnreached = [];
for (const rule of fieldPracticeGuidance.profiles)
  for (const protocolId of rule.protocolIds) {
    const key = `${rule.ruleId} :: ${protocolId}`;
    if (!reachedRuleProtocols.has(key) && !declaredUnreached.has(key))
      undeclaredUnreached.push(key);
  }
if (undeclaredUnreached.length)
  throw new Error(
    `Field-practice rules declare a protocol whose roster never carries the product: ${undeclaredUnreached.join(", ")}`,
  );
const staleUnreached = [...declaredUnreached].filter((key) =>
  reachedRuleProtocols.has(key),
);
if (staleUnreached.length)
  throw new Error(
    `Unreached-protocol notes describe a link that now exists: ${staleUnreached.join(", ")}`,
  );

// 식약처 DUR 병용금기를 제품의 interactions 에 얹는다. 엔진은 손님이 지금
// 먹는 약을 이 목록과 대조해 후보를 제외하므로(recommendation/src/index.ts),
// 여기에 들어가야 실제로 작동한다. 후보 파일이 없으면 조용히 넘어간다 —
// 첫 패스에서는 아직 만들어지지 않았기 때문이다.
const durInteractionsPath = join(
  root,
  "data/actual-candidate-pack/mfds-dur-interactions.json",
);
const durInteractionNamesByProductId = new Map();
if (existsSync(durInteractionsPath)) {
  const durCandidates = JSON.parse(readFileSync(durInteractionsPath, "utf8"));
  for (const finding of durCandidates.findings ?? [])
    for (const affected of finding.affectedProducts ?? []) {
      if (!durInteractionNamesByProductId.has(affected.productId))
        durInteractionNamesByProductId.set(affected.productId, new Set());
      const names = durInteractionNamesByProductId.get(affected.productId);
      if (finding.counterpartKo) names.add(finding.counterpartKo);
      if (finding.counterpartEn) names.add(finding.counterpartEn);
    }
}
const productsWithDurInteractions = runtimeProducts.map((product) => {
  const extra = durInteractionNamesByProductId.get(product.product_id);
  if (!extra?.size) return product;
  return {
    ...product,
    interactions: [...new Set([...(product.interactions ?? []), ...extra])],
  };
});

const pack = {
  packId: "PACK-PHARMASSIST-KR-OTC-ACTUAL-20260713",
  version: "1.0.0-research-preview",
  domain: "human_otc",
  synthetic: false,
  clinicalUseProhibited: true,
  verified: false,
  createdAt: "2026-07-13T12:00:00+09:00",
  expiresAt: "2027-01-13T00:00:00+09:00",
  sources: runtimeSources,
  ingredients: [
    ...ingredients,
    ...generatedIngredients,
    ...mfdsPackIngredients,
  ].map((item) => ({
    ...item,
    review: previewReview(item.review),
  })),
  products: productsWithDurInteractions,
  productIngredients: runtimeProductIngredients,
  claims: [...claims, ...generatedClaims].map((sourceItem) => ({
    ...applyProtocolDenylistToClaim(sourceItem),
    status: "published",
    review: previewReview(sourceItem.review),
  })),
  protocols: allProtocolTemplates.map((item) => ({
    ...item,
    status: "published",
    review: previewReview(item.review),
    rule_ids: [
      ...item.rule_ids.filter((ruleId) => previewRuleIds.has(ruleId)),
      ...selectionOverlayRules
        .filter((rule) => rule.protocol_id === item.protocol_id)
        .map((rule) => rule.rule_id),
    ],
    option_ids: [
      ...item.option_ids,
      ...generatedProtocolOptions
        .filter((option) => option.protocol_id === item.protocol_id)
        .map((option) => option.option_id),
    ],
    triggers: {
      ...item.triggers,
      aliases: [
        ...new Set([
          ...item.triggers.aliases,
          ...(triggerSupplements[item.protocol_id] ?? []),
          ...aliasSeeds
            .filter(
              (alias) =>
                intentProtocolMap[alias.intent_id] === item.protocol_id,
            )
            .map((alias) => alias.phrase),
        ]),
      ],
    },
  })),
  protocolOptions: [...protocolOptions, ...generatedProtocolOptions].map(
    (item) => {
      const fit = therapeuticFitByOptionId.get(item.option_id);
      const pathway = clinicalPathwayByProtocolId.get(item.protocol_id);
      return {
        ...item,
        therapeutic_role: fit?.role ?? item.therapeutic_role,
        evidence_scope: fit?.evidence_scope ?? item.evidence_scope,
        fit_rationale: fit?.rationale ?? item.fit_rationale,
        pathway_mechanisms: item.pathway_mechanisms ?? pathway?.mechanisms,
        combination_roles:
          item.combination_roles ??
          (pathway?.combinationRole ? [pathway.combinationRole] : undefined),
        compatible_roles:
          item.compatible_roles ?? pathway?.compatibleRoles ?? [],
        status: "published",
        review: previewReview(item.review),
      };
    },
  ),
  // Candidate ask rules remain local research-preview guidance. The runtime
  // presents them progressively alongside provisional candidates; this does
  // not convert them into production-approved clinical rules.
  protocolRules: previewProtocolRules.map((item) => ({
    ...item,
    status: "published",
    review: previewReview(item.review),
  })),
  cards: dialogueCards,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(pack)}\n`, "utf8");
await writeFile(
  enrichmentOutput,
  `${JSON.stringify(enrichmentIndex)}\n`,
  "utf8",
);
await mkdir(productImageOutput, { recursive: true });
await cp(join(source, "product-enrichment", "images"), productImageOutput, {
  recursive: true,
});
await cp(productMediaImageSource, productImageOutput, { recursive: true });
await writeFile(
  dialogueReportOutput,
  `${JSON.stringify(
    {
      intentCount: intentSeeds.length,
      aliasCount: aliasSeeds.length,
      cardCount: dialogueCards.length,
      mappedIntentIds: Object.keys(intentProtocolMap),
      conversationOnlyIntentIds: intentSeeds
        .map((item) => item.intent_id)
        .filter((intentId) => !intentProtocolMap[intentId]),
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  healthKrLegacyMatchReportOutput,
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      total: legacyMatchRecords.length,
      matched: legacyMatchRecords.filter((item) => item.status === "matched")
        .length,
      failed: legacyMatchRecords.filter((item) => item.status === "failed")
        .length,
      ambiguous: legacyMatchRecords.filter(
        (item) => item.status === "ambiguous",
      ).length,
      records: legacyMatchRecords,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  fieldPracticeGuidanceReportOutput,
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      sourceId: fieldPracticeGuidance.source.sourceId,
      sourceContentSha256: fieldPracticeGuidance.source.contentSha256,
      ruleCount: fieldPracticeGuidance.profiles.length,
      appliedRuleCount: new Set(
        fieldPracticeApplications.map((item) => item.ruleId),
      ).size,
      applicationCount: fieldPracticeApplications.length,
      unmatchedRuleIds: fieldPracticeGuidance.profiles
        .map((rule) => rule.ruleId)
        .filter(
          (ruleId) =>
            !fieldPracticeApplications.some((item) => item.ruleId === ruleId),
        ),
      applications: fieldPracticeApplications,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write(
  `built ${pack.version}: ${pack.ingredients.length} ingredients, ${runtimeProducts.length} products, ${allProtocolTemplates.length} protocols, ${pack.protocolOptions.length} options, ${enrichmentIndex.length} enriched products, ${dialogueCards.length} dialogue intents, ${aliasSeeds.length} aliases\n`,
);
