/**
 * Builds the pharmacist review queue from the pack itself.
 *
 * The field-practice PDF gave the pack its selection wording, and some of that
 * wording is clinically load-bearing: a contraceptive schedule, an age limit, a
 * nicotine strength, a burn depth. Those need a pharmacist to sign them off
 * before anything is approved for clinical use. This turns that obligation into
 * a concrete, regenerable work list instead of a note in a document.
 *
 * The queue never approves anything. It carries whatever decisions a pharmacist
 * has already recorded in pharmacist-review-decisions.json and leaves the rest
 * pending, so re-running after a pack rebuild does not throw away review work.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (relativePath) =>
  JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
const readJsonIfPresent = async (relativePath) => {
  try {
    return await readJson(relativePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const packPath = "data/actual-candidate-pack/pack.json";
const decisionsPath =
  "data/actual-candidate-pack/pharmacist-review-decisions.json";
const outputPath = "data/actual-candidate-pack/pharmacist-review-queue.json";

const pack = await readJson(packPath);
const areasFile = await readJson(
  "data/clinical-pathways/pharmacist-review-areas.json",
);
const decisionsFile = await readJsonIfPresent(decisionsPath);

if (areasFile.schemaVersion !== "1.0.0" || !Array.isArray(areasFile.areas))
  throw new Error("pharmacist-review-areas.json is invalid");

const protocolById = new Map(
  pack.protocols.map((protocol) => [protocol.protocol_id, protocol]),
);
// A protocol can carry several referral rules and a reviewer has to judge the
// wording against all of them, not whichever one happened to be last.
const referTermsByProtocolId = new Map();
for (const rule of pack.protocolRules) {
  if (rule.effect !== "refer" || !Array.isArray(rule.value)) continue;
  const terms = referTermsByProtocolId.get(rule.protocol_id) ?? [];
  for (const term of rule.value) if (!terms.includes(term)) terms.push(term);
  referTermsByProtocolId.set(rule.protocol_id, terms);
}

// A pharmacist reviews sentences, not field names. Each entry is one block of
// text they have to read and accept or reject.
const reviewTargetsFor = (profile) => {
  const targets = [];
  if (profile.choose_when)
    targets.push({ field: "choose_when", text: profile.choose_when });
  if (profile.comparison_note)
    targets.push({ field: "comparison_note", text: profile.comparison_note });
  for (const [index, text] of (profile.differentiators ?? []).entries())
    targets.push({ field: `differentiators[${index}]`, text });
  for (const [index, text] of (profile.practical_points ?? []).entries())
    targets.push({ field: `practical_points[${index}]`, text });
  return targets;
};

const priorDecisionByItemId = new Map(
  (decisionsFile?.decisions ?? []).map((decision) => [
    decision.itemId,
    decision,
  ]),
);
const carriedDecisionIds = new Set();

const items = [];
for (const area of areasFile.areas) {
  if (
    typeof area.areaId !== "string" ||
    typeof area.title !== "string" ||
    typeof area.whyReviewNeeded !== "string" ||
    !Array.isArray(area.protocolIds) ||
    area.protocolIds.length === 0 ||
    !Array.isArray(area.mustConfirm) ||
    area.mustConfirm.length === 0
  )
    throw new Error(
      `Invalid pharmacist review area: ${area.areaId ?? "unknown"}`,
    );

  for (const protocolId of area.protocolIds) {
    const protocol = protocolById.get(protocolId);
    if (!protocol)
      throw new Error(
        `Pharmacist review area ${area.areaId} points at a protocol the pack does not have: ${protocolId}`,
      );

    const products = pack.products.filter((product) =>
      (product.selection_profiles ?? []).some(
        (profile) => profile.protocol_id === protocolId,
      ),
    );
    if (products.length === 0)
      throw new Error(
        `Pharmacist review area ${area.areaId} covers ${protocolId}, which has no product to review`,
      );

    for (const product of products) {
      const profile = product.selection_profiles.find(
        (candidate) => candidate.protocol_id === protocolId,
      );
      const reviewTargets = reviewTargetsFor(profile);
      if (reviewTargets.length === 0)
        throw new Error(
          `No reviewable wording for ${product.product_id} on ${protocolId}`,
        );
      if (!profile.evidence_source)
        throw new Error(
          `No source locator for ${product.product_id} on ${protocolId}`,
        );

      const itemId = `PRQ-${area.areaId}-${product.product_id}`;
      const prior = priorDecisionByItemId.get(itemId);
      if (prior) carriedDecisionIds.add(itemId);
      items.push({
        itemId,
        kind: "clinical_area",
        // Quoted from the field-practice PDF, so it has a page to check against.
        origin: "field_practice_pdf",
        areaId: area.areaId,
        areaTitle: area.title,
        whyReviewNeeded: area.whyReviewNeeded,
        mustConfirm: area.mustConfirm,
        protocolId,
        protocolName: protocol.display_name,
        productId: product.product_id,
        productName: product.display_name,
        reviewTargets,
        sourceLocator: profile.evidence_source,
        referRedFlags: referTermsByProtocolId.get(protocolId) ?? [],
        // Nothing here approves itself. A decision only appears because a
        // pharmacist wrote it into pharmacist-review-decisions.json.
        status: prior?.status ?? "pending",
        decision: prior?.decision ?? null,
        reviewerId: prior?.reviewerId ?? null,
        reviewedAt: prior?.reviewedAt ?? null,
        reviewerNote: prior?.reviewerNote ?? null,
      });
    }
  }
}

// The card copy is a second review surface. Unlike the field-practice items
// above it quotes no document: the contrast sentences were written to replace a
// circular template, and the only thing behind them is the pack's own
// composition and dosage-form record. That makes them more in need of a
// pharmacist's eye, not less, so the queue says so rather than implying a
// source page exists.
const selectionCopy = await readJson(
  "data/actual-research-overlays/selection-copy.json",
);
const ingredientIdByName = new Map();
for (const item of pack.ingredients) {
  const name = item.display_name_ko;
  ingredientIdByName.set(
    name,
    ingredientIdByName.has(name) ? "AMBIGUOUS" : item.ingredient_id,
  );
}
const copyMustConfirm = [
  "이 문장이 같은 프로토콜의 다른 후보와 실제로 갈리는 지점을 말하는지",
  "성분·제형 서술이 허가사항과 어긋나지 않는지",
  "손님에게 그대로 옮겨도 오해를 만들지 않는지",
  "빠뜨리면 안 되는 금기나 주의가 이 문장 때문에 가려지지 않는지",
];
for (const entry of selectionCopy.entries) {
  const ingredientKey =
    entry.ingredient === "COMBO"
      ? "COMBO"
      : ingredientIdByName.get(entry.ingredient);
  if (!ingredientKey || ingredientKey === "AMBIGUOUS")
    throw new Error(
      `Selection copy ingredient does not resolve: ${entry.ingredient}`,
    );
  const protocol = protocolById.get(entry.protocolId);
  if (!protocol)
    throw new Error(`Selection copy protocol missing: ${entry.protocolId}`);

  const affected = pack.products.filter((product) => {
    const active = (product.active_ingredients ?? []).map(
      (item) => item.ingredient_id,
    );
    const key = active.length === 1 ? active[0] : "COMBO";
    if (key !== ingredientKey) return false;
    return (product.selection_profiles ?? []).some(
      (profile) =>
        profile.protocol_id === entry.protocolId &&
        profile.comparison_note === entry.comparisonNote,
    );
  });
  if (affected.length === 0)
    throw new Error(
      `Selection copy reaches no product: ${entry.protocolId}/${entry.ingredient}`,
    );

  // The wording a pharmacist has to accept: the contrast sentence plus the
  // condition line the same candidates show above it.
  const chooseWhens = [
    ...new Set(
      affected.flatMap((product) =>
        (product.selection_profiles ?? [])
          .filter(
            (profile) =>
              profile.protocol_id === entry.protocolId &&
              profile.comparison_note === entry.comparisonNote,
          )
          .map((profile) => profile.choose_when)
          .filter((text) => typeof text === "string" && text.length > 0),
      ),
    ),
  ];
  // A protocol whose candidates are all combination products carries several
  // notes on the same ingredient group, split by choose_when cluster, so the
  // cluster has to be part of the id.
  const baseId = `PRQ-COPY-${entry.protocolId}-${entry.ingredient === "COMBO" ? "COMBO" : ingredientKey}`;
  const itemId = entry.chooseWhenContains
    ? `${baseId}-${createHash("sha256").update(entry.chooseWhenContains).digest("hex").slice(0, 8)}`
    : baseId;
  if (items.some((item) => item.itemId === itemId))
    throw new Error(`Duplicate selection copy review item: ${itemId}`);
  const prior = priorDecisionByItemId.get(itemId);
  if (prior) carriedDecisionIds.add(itemId);
  items.push({
    itemId,
    kind: "selection_copy",
    // No page to check against — this is written text, not a quotation.
    origin: "authored_contrast",
    areaId: "selection-card-copy",
    areaTitle: "제품 카드 비교 문구",
    whyReviewNeeded:
      "약사가 후보를 고를 때 읽는 문장이다. 출처 문서가 없고 팩의 성분·제형 기록만 근거로 작성했으므로, 임상적으로 틀린 대조가 있으면 그대로 상담에 나간다.",
    mustConfirm: copyMustConfirm,
    protocolId: entry.protocolId,
    protocolName: protocol.display_name,
    ingredientGroup: entry.ingredient,
    affectedProducts: affected.map((product) => product.display_name),
    reviewTargets: [
      { field: "comparison_note", text: entry.comparisonNote },
      ...chooseWhens.map((text) => ({ field: "choose_when", text })),
    ],
    sourceLocator: null,
    referRedFlags: referTermsByProtocolId.get(entry.protocolId) ?? [],
    status: prior?.status ?? "pending",
    decision: prior?.decision ?? null,
    reviewerId: prior?.reviewerId ?? null,
    reviewedAt: prior?.reviewedAt ?? null,
    reviewerNote: prior?.reviewerNote ?? null,
  });
}

// Whatever the two passes above did not claim is wording the original pipeline
// produced and nobody has ever agreed to. It is on the card either way, so it
// belongs in the queue rather than in the gap between two review surfaces.
const queuedNotes = new Set(
  items.flatMap((item) =>
    item.reviewTargets
      .filter((target) => target.field === "comparison_note")
      .map((target) => target.text),
  ),
);
// Most of what is left is still field-practice wording. The six clinical areas
// cover only part of the PDF, so the rest of it reaches this sweep — it has a
// page to check against and must not be reported as unreviewed machine output.
const fieldPracticeGuidance = await readJson(
  "data/clinical-pathways/field-practice-guidance.json",
);
const fieldPracticeByNote = new Map(
  fieldPracticeGuidance.profiles.map((rule) => [rule.comparisonNote, rule]),
);
const pipelineNotes = new Map();
for (const product of pack.products)
  for (const profile of product.selection_profiles ?? []) {
    const note = profile.comparison_note;
    if (typeof note !== "string" || note.length === 0) continue;
    if (queuedNotes.has(note)) continue;
    const key = `${profile.protocol_id} :: ${note}`;
    if (!pipelineNotes.has(key))
      pipelineNotes.set(key, {
        protocolId: profile.protocol_id,
        note,
        products: [],
        chooseWhens: new Set(),
      });
    pipelineNotes.get(key).products.push(product.display_name);
    if (profile.choose_when)
      pipelineNotes.get(key).chooseWhens.add(profile.choose_when);
  }
for (const entry of pipelineNotes.values()) {
  const protocol = protocolById.get(entry.protocolId);
  if (!protocol)
    throw new Error(
      `Pipeline note points at a missing protocol: ${entry.protocolId}`,
    );
  const itemId = `PRQ-PIPE-${entry.protocolId}-${createHash("sha256").update(entry.note).digest("hex").slice(0, 8)}`;
  const prior = priorDecisionByItemId.get(itemId);
  if (prior) carriedDecisionIds.add(itemId);
  items.push({
    itemId,
    kind: "selection_copy",
    origin: fieldPracticeByNote.has(entry.note)
      ? "field_practice_pdf"
      : "pipeline_generated",
    areaId: "selection-card-copy",
    areaTitle: "제품 카드 비교 문구",
    whyReviewNeeded: fieldPracticeByNote.has(entry.note)
      ? "현장실습 자료에서 온 문구인데 위 여섯 개 임상 영역에 걸리지 않는 프로토콜에 붙어 있다. 출처 페이지가 있으니 원문과 대조해서 확인한다."
      : "빌드가 공식 항목에서 자동으로 만든 문장이라 사람이 한 번도 읽지 않았다. 카드에는 그대로 나가므로 임상적으로 어긋나는 대조가 있으면 상담에 실린다.",
    mustConfirm: copyMustConfirm,
    protocolId: entry.protocolId,
    protocolName: protocol.display_name,
    ingredientGroup: null,
    affectedProducts: [...new Set(entry.products)],
    reviewTargets: [
      { field: "comparison_note", text: entry.note },
      ...[...entry.chooseWhens].map((text) => ({ field: "choose_when", text })),
    ],
    // Field-practice wording that reached this sweep keeps its page; only text
    // the build invented has nothing to cite.
    sourceLocator: fieldPracticeByNote.has(entry.note)
      ? `${fieldPracticeGuidance.source.sourceId}#page=${fieldPracticeByNote.get(entry.note).page}`
      : null,
    referRedFlags: referTermsByProtocolId.get(entry.protocolId) ?? [],
    status: prior?.status ?? "pending",
    decision: prior?.decision ?? null,
    reviewerId: prior?.reviewerId ?? null,
    reviewedAt: prior?.reviewedAt ?? null,
    reviewerNote: prior?.reviewerNote ?? null,
  });
}

const orphanDecisionIds = [...priorDecisionByItemId.keys()]
  .filter((itemId) => !carriedDecisionIds.has(itemId))
  .sort();
if (orphanDecisionIds.length > 0)
  throw new Error(
    `Recorded review decisions no longer match any queue item: ${orphanDecisionIds.join(", ")}`,
  );

const countByStatus = items.reduce(
  (totals, item) => ({
    ...totals,
    [item.status]: (totals[item.status] ?? 0) + 1,
  }),
  {},
);
const queue = {
  schemaVersion: "1.0.0",
  packId: pack.packId,
  packVersion: pack.version,
  clinicalUseProhibited: pack.clinicalUseProhibited,
  generatedFrom: {
    pack: packPath,
    packProtocolCount: pack.protocols.length,
    areasSha256: createHash("sha256")
      .update(JSON.stringify(areasFile))
      .digest("hex"),
  },
  statusLegend: {
    pending: "약사가 아직 보지 않음. 기본값이며 생성기가 바꾸지 않는다.",
    approved: "약사가 문구를 그대로 써도 된다고 확인함.",
    revise: "약사가 문구 수정을 요구함. decision에 수정 내용을 적는다.",
    rejected: "약사가 이 문구를 쓰면 안 된다고 판단함.",
  },
  howToRecordDecision: {
    file: decisionsPath,
    shape: {
      decisions: [
        {
          itemId: "아래 items[].itemId 중 하나",
          status: "approved | revise | rejected",
          decision: "revise면 바꿀 문구, 그 외에는 null",
          reviewerId: "검토한 약사 식별자",
          reviewedAt: "ISO 8601 시각",
          reviewerNote: "판단 근거. 없으면 null",
        },
      ],
    },
    note: "이 파일에 적은 결정만 큐에 반영된다. 생성기는 어떤 항목도 스스로 승인하지 않고, items에 없는 itemId가 남아 있으면 빌드를 실패시킨다.",
  },
  areaCount: areasFile.areas.length,
  itemCount: items.length,
  countByKind: items.reduce(
    (totals, item) => ({
      ...totals,
      [item.kind]: (totals[item.kind] ?? 0) + 1,
    }),
    {},
  ),
  originLegend: {
    field_practice_pdf:
      "현장실습 PDF에서 인용한 문구. sourceLocator의 페이지와 대조할 수 있다.",
    authored_contrast:
      "출처 문서 없이 작성한 대조 문장. 근거는 팩의 성분·제형 기록뿐이라 임상 판단은 검토가 필요하다.",
  },
  countByStatus,
  items,
};

await writeFile(
  resolve(root, outputPath),
  `${JSON.stringify(queue, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    areas: queue.areaCount,
    items: queue.itemCount,
    countByStatus,
    carriedDecisions: carriedDecisionIds.size,
  }),
);
