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
const referRuleByProtocolId = new Map(
  pack.protocolRules
    .filter((rule) => rule.effect === "refer" && Array.isArray(rule.value))
    .map((rule) => [rule.protocol_id, rule]),
);

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
        referRedFlags: referRuleByProtocolId.get(protocolId)?.value ?? [],
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
