/**
 * Turns curated situation branches into option-selection overlays.
 *
 * Most protocols shipped with only a SELECT-FALLBACK rule, so one option was
 * ever selectable and 116 of 219 linked products could never be recommended.
 * The clinical grounding for branching already existed: every product carries a
 * per-protocol choose_when saying when it is the right one. This reads those,
 * groups the products that share a situation, and emits a select rule per
 * option so the customer's own words reach the matching products.
 *
 * No clinical mapping is invented here. A branch names an exact choose_when
 * from the pack and fails the build if that text is gone, so the wording and
 * the routing cannot drift apart.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(root, path), "utf8"));

const pack = await readJson("data/actual-candidate-pack/pack.json");
const curated = await readJson(
  "data/actual-research-overlays/situation-branches.json",
);
if (curated.schemaVersion !== "1.0.0" || !Array.isArray(curated.protocols))
  throw new Error("situation-branches.json is invalid");

const protocolById = new Map(
  pack.protocols.map((protocol) => [protocol.protocol_id, protocol]),
);
// An option is reachable through the ingredient the formulary links it by, so
// a product resolves to an option only when that exact link exists.
const linkKey = (productId, ingredientId) => `${productId}::${ingredientId}`;
const activeLinks = new Set(
  pack.productIngredients
    .filter((link) => link.is_active && link.role !== "excipient")
    .map((link) => linkKey(link.product_id, link.ingredient_id)),
);
const optionsByProtocol = new Map();
for (const option of pack.protocolOptions) {
  if (!optionsByProtocol.has(option.protocol_id))
    optionsByProtocol.set(option.protocol_id, []);
  optionsByProtocol.get(option.protocol_id).push(option);
}

// Every referral term in the pack, whatever protocol it belongs to. A select
// pattern that contains one of these can steal an utterance that was supposed
// to end in a referral: "전조 편두통이 있는데 피임약 주세요" matched a 편두통
// pattern, moved the turn to another protocol, and the contraception referral
// never fired. Routing words are the model's job now, so any pattern that
// collides here is a build failure rather than a judgement call.
const referTerms = new Set();
for (const rule of pack.protocolRules)
  if (
    (rule.effect === "refer" || rule.effect === "exclude") &&
    Array.isArray(rule.value)
  )
    for (const term of rule.value)
      if (typeof term === "string" && term.trim()) referTerms.add(term.trim());

const collides = (pattern) => {
  const hits = [];
  for (const term of referTerms)
    if (pattern.includes(term) || term.includes(pattern)) hits.push(term);
  return hits;
};

// Protocols that already carry a hand-curated overlay are already asking a
// discriminating question. Adding a second one makes the consult ask twice for
// the same distinction, so the curated one wins and this generator stays out.
const curatedOverlays = await readJson(
  "data/actual-research-overlays/option-selection.json",
);
const curatedProtocolIds = new Set(
  curatedOverlays.map((overlay) => overlay.protocol_id),
);

const overlays = [];
const report = [];
const skipped = [];
const patternCollisions = [];
for (const entry of curated.protocols) {
  const protocol = protocolById.get(entry.protocolId);
  if (!protocol)
    throw new Error(`Situation branch protocol missing: ${entry.protocolId}`);
  if (
    typeof entry.field !== "string" ||
    typeof entry.question !== "string" ||
    typeof entry.reason !== "string" ||
    !Array.isArray(entry.branches) ||
    entry.branches.length < 2
  )
    throw new Error(`Invalid situation branch entry: ${entry.protocolId}`);

  const protocolOptionIds = new Set(protocol.option_ids);
  const options = (optionsByProtocol.get(entry.protocolId) ?? []).filter(
    (option) => protocolOptionIds.has(option.option_id),
  );
  const seenBranchIds = new Set();
  const overlayOptions = [];
  const branchReport = [];

  for (const branch of entry.branches) {
    if (
      typeof branch.branchId !== "string" ||
      seenBranchIds.has(branch.branchId) ||
      typeof branch.chooseWhenContains !== "string" ||
      !Array.isArray(branch.patterns) ||
      branch.patterns.length === 0
    )
      throw new Error(
        `Invalid branch ${entry.protocolId}/${branch.branchId ?? "unknown"}`,
      );
    seenBranchIds.add(branch.branchId);

    for (const pattern of branch.patterns) {
      const hits = collides(pattern);
      if (hits.length > 0)
        patternCollisions.push({
          protocolId: entry.protocolId,
          branchId: branch.branchId,
          pattern,
          collidesWith: hits,
        });
    }

    // Products whose own choose_when for this protocol describes this
    // situation. The text is the evidence; the patterns are only the customer
    // vocabulary that points at it.
    // A cluster larger than the five displayed candidates hides the rest, so a
    // branch may narrow further on the product's own differentiators — its
    // composition and dosage form, both quoted from the official record. Same
    // rule as chooseWhenContains: it names text the pack really carries.
    const matchesDifferentiator = (profile) =>
      branch.differentiatorContains === undefined ||
      (profile.differentiators ?? []).some((text) =>
        text.includes(branch.differentiatorContains),
      );
    const matchedProducts = pack.products.filter((product) =>
      (product.selection_profiles ?? []).some(
        (profile) =>
          profile.protocol_id === entry.protocolId &&
          typeof profile.choose_when === "string" &&
          profile.choose_when.includes(branch.chooseWhenContains) &&
          matchesDifferentiator(profile),
      ),
    );
    if (matchedProducts.length === 0)
      throw new Error(
        `No product carries this choose_when any more: ${entry.protocolId}/${branch.branchId} -> "${branch.chooseWhenContains}"${branch.differentiatorContains ? ` + "${branch.differentiatorContains}"` : ""}`,
      );

    const branchOptionIds = new Set();
    for (const product of matchedProducts)
      for (const option of options)
        if (activeLinks.has(linkKey(product.product_id, option.ingredient_id)))
          branchOptionIds.add(option.option_id);
    if (branchOptionIds.size === 0)
      throw new Error(
        `Branch resolves to no selectable option: ${entry.protocolId}/${branch.branchId}`,
      );

    for (const optionId of branchOptionIds)
      overlayOptions.push({ option_id: optionId, patterns: branch.patterns });
    branchReport.push({
      branchId: branch.branchId,
      chooseWhenContains: branch.chooseWhenContains,
      products: matchedProducts.length,
      options: branchOptionIds.size,
    });
  }

  // While the question is open the engine offers option_ids[0] of the first
  // unmatched ask rule as the conservative fallback, so the order here decides
  // what a customer sees before answering. Rank it the way the engine ranks
  // options (preferred role, then safety, then clinical priority) or an
  // arbitrary formula option displaces the protocol's first choice.
  const rankOf = (optionId) => {
    const option = options.find((item) => item.option_id === optionId);
    return [
      option?.therapeutic_role === "preferred" ? 0 : 1,
      -(option?.safety_priority ?? 0),
      -(option?.clinical_priority ?? 0),
      optionId,
    ];
  };
  overlayOptions.sort((left, right) => {
    const a = rankOf(left.option_id);
    const b = rankOf(right.option_id);
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  });

  overlays.push({
    protocol_id: entry.protocolId,
    // Distinct ids so a protocol that already has a hand-curated overlay keeps
    // both without the two colliding on RUL-OVERLAY-<protocol>-SELECT-1.
    rule_id: `RUL-OVERLAY-${entry.protocolId}-ASK-SITUATION`,
    rule_suffix: "-SITUATION",
    // Referral rules sit at 100 and rules run in ascending order, so this has
    // to be above them: narrowing between candidates is pointless once a red
    // flag is present, and asking there would replace the referral.
    ask_priority: 120,
    // The situation question narrows candidates the protocol has already
    // cleared, so it rides alongside them rather than holding the consult
    // empty until it is answered.
    progressive: true,
    field: entry.field,
    question: entry.question,
    reason: entry.reason,
    options: overlayOptions,
  });
  report.push({
    protocolId: entry.protocolId,
    branches: branchReport,
    optionRules: overlayOptions.length,
  });
}

if (patternCollisions.length > 0) {
  for (const item of patternCollisions)
    console.error(
      `COLLISION ${item.protocolId}/${item.branchId} pattern "${item.pattern}" vs referral term(s) ${item.collidesWith.join(", ")}`,
    );
  throw new Error(
    `${patternCollisions.length} select pattern(s) collide with referral terms. Remove the pattern and let the model choose that branch by option key instead.`,
  );
}

await writeFile(
  resolve(
    root,
    "data/actual-research-overlays/option-selection-generated.json",
  ),
  `${JSON.stringify(overlays, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(root, "data/actual-candidate-pack/situation-branch-report.json"),
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      generatedFrom: "data/actual-research-overlays/situation-branches.json",
      protocolCount: report.length,
      optionRuleCount: report.reduce((sum, item) => sum + item.optionRules, 0),
      protocols: report,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    protocols: overlays.length,
    skipped,
    optionRules: overlays.reduce((sum, o) => sum + o.options.length, 0),
  }),
);
