import { createHash } from "node:crypto";
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
const healthKrLegacyMatchReportOutput = join(
  root,
  "data",
  "actual-candidate-pack",
  "healthkr-legacy-match-report.json",
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
  triggerSupplements,
  dialogueCopies,
  therapeuticFit,
  productMediaOverlays,
  healthKrRegistryBody,
  healthKrRegistryManifest,
  healthKrProductCrosswalk,
  clinicalPathwayMappings,
  clinicalPathwayDefinitions,
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
  readFile(selectionOverlaySource, "utf8").then(JSON.parse),
  readFile(triggerSupplementSource, "utf8").then(JSON.parse),
  readFile(dialogueCopySource, "utf8").then(JSON.parse),
  readFile(therapeuticFitSource, "utf8").then(JSON.parse),
  readFile(productMediaOverlaySource, "utf8").then(JSON.parse),
  readFile(healthKrRegistrySource, "utf8"),
  readFile(healthKrRegistryManifestSource, "utf8").then(JSON.parse),
  readFile(healthKrProductCrosswalkSource, "utf8").then(JSON.parse),
  readFile(clinicalPathwayMappingSource, "utf8").then(JSON.parse),
  readFile(clinicalPathwayDefinitionSource, "utf8").then(JSON.parse),
]);

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
if (
  clinicalPathwayMappings.schemaVersion !== "1.0.0" ||
  clinicalPathwayMappings.records.length !== healthKrRegistry.records.length
)
  throw new Error("Clinical pathway mappings are missing or inconsistent");

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
const newProducts = [];
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
const generatedIngredients = [...generatedIngredientById.values()];
const generatedProtocolOptions = [];
const generatedClaims = [];
for (const group of generatedOptionGroups.values()) {
  const protocolTemplate = protocols.find(
    (protocol) => protocol.protocol_id === group.protocolId,
  );
  const optionTemplate = protocolOptions.find(
    (option) => option.protocol_id === group.protocolId,
  );
  if (!protocolTemplate || !optionTemplate)
    throw new Error(
      `Clinical pathway protocol is missing: ${group.protocolId}`,
    );
  const suffix = `${group.protocolId.replace(/^PTC-/u, "")}-${group.ingredientId.replace(/^ING-/u, "")}`;
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
    eligibility_rule_ids: optionTemplate.eligibility_rule_ids,
    exclusion_rule_ids: optionTemplate.exclusion_rule_ids,
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
const productsWithHealthKrOverlays = [...products, ...newProducts].map(
  (product) => {
    const record = overlayRecordFor(product);
    if (!record) return product;
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
    return {
      ...product,
      ...healthKrProductMetadata(
        record,
        clinicalPathwayByRegistryRecordId.get(record.registryRecordId),
      ),
      source_snapshot_ids: [
        ...new Set([...product.source_snapshot_ids, healthKrSnapshotId]),
      ],
      source_refs: [...product.source_refs, sourceRef],
      dur_flags: durFlags,
    };
  },
);

const runtimeSources = [...sources, ...newSources];
const runtimeProducts = [...productsWithHealthKrOverlays, ...healthKrProducts];
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

const selectionOverlayRules = selectionOverlays.flatMap((overlay) => {
  const protocol = protocols.find(
    (item) => item.protocol_id === overlay.protocol_id,
  );
  if (!protocol)
    throw new Error(
      `Selection overlay protocol missing: ${overlay.protocol_id}`,
    );
  const optionIds = new Set(protocol.option_ids);
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
      option_ids: progressiveOnly
        ? []
        : overlay.options.map((option) => option.option_id),
      question: overlay.question,
      reason: overlay.reason,
      priority: 1,
      status: "published",
      review: baseReview,
      source_refs: protocol.source_refs,
    },
    ...(progressiveOnly ? [] : overlay.options).map((option, index) => ({
      rule_id: `RUL-OVERLAY-${overlay.protocol_id}-SELECT-${index + 1}`,
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
  ingredients: [...ingredients, ...generatedIngredients].map((item) => ({
    ...item,
    review: previewReview(item.review),
  })),
  products: runtimeProducts,
  productIngredients: runtimeProductIngredients,
  claims: [...claims, ...generatedClaims].map((item) => ({
    ...item,
    status: "published",
    review: previewReview(item.review),
  })),
  protocols: protocols.map((item) => ({
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
process.stdout.write(
  `built ${pack.version}: ${pack.ingredients.length} ingredients, ${runtimeProducts.length} products, ${protocols.length} protocols, ${pack.protocolOptions.length} options, ${enrichmentIndex.length} enriched products, ${dialogueCards.length} dialogue intents, ${aliasSeeds.length} aliases\n`,
);
