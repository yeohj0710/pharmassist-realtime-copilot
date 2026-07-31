/**
 * Merges the book1 evidence layer into the candidate pack. Idempotent: running
 * it twice leaves the pack byte-identical, so it can be re-run after every
 * batch of extraction without drift.
 *
 * It only ever adds. Existing sources, claims, protocols, options and rules are
 * carried through untouched, except where a book1 claim was recorded as
 * corroborating an existing one — then the existing claim gains a source_ref
 * and nothing else changes.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const corpusDir = resolve("C:/dev/book-corpus/corpus/book1-bogyak");
const packPath = resolve(root, "data/actual-candidate-pack/pack.json");
const evidenceDir = resolve(root, "data/book1-evidence");

const readCorpus = async () => {
  const names = (await readdir(corpusDir)).filter((name) =>
    name.endsWith(".md"),
  );
  return Promise.all(
    names.map(async (fileName) => ({
      fileName,
      text: await readFile(resolve(corpusDir, fileName), "utf8"),
    })),
  );
};

const corpusDigest = (files) => {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) =>
    a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0,
  )) {
    hash.update(file.fileName, "utf8");
    hash.update(" ", "utf8");
    hash.update(file.text.replace(/\r\n/gu, "\n"), "utf8");
    hash.update(" ", "utf8");
  }
  return hash.digest("hex");
};

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
};

const files = await readCorpus();
const pageMap = JSON.parse(
  await readFile(resolve(corpusDir, "_pagemap.json"), "utf8"),
);
const qaLines = (await readFile(resolve(corpusDir, "qa.jsonl"), "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean);

const digest = corpusDigest(files);
const { book1SourceSnapshot } = await import(
  pathToFileURL(resolve(root, "tools/ingest/dist/book1-bogyak.js")).href
);
const source = book1SourceSnapshot(digest, {
  records: qaLines.length,
  pages: pageMap.included.length,
});

const claims = await readJson(resolve(evidenceDir, "claims.json"), []);
const rules = await readJson(resolve(evidenceDir, "rules.json"), []);
const corroborations = await readJson(
  resolve(evidenceDir, "corroborations.json"),
  [],
);

const pack = JSON.parse(await readFile(packPath, "utf8"));

const before = {
  sources: pack.sources.length,
  claims: pack.claims.length,
  protocols: pack.protocols.length,
  protocolOptions: pack.protocolOptions.length,
  protocolRules: pack.protocolRules.length,
};

const isBook1 = (id) => String(id ?? "").includes("BOOK1");
const keepNonBook1 = (items, key) =>
  items.filter((item) => !isBook1(item[key]));

pack.sources = [
  ...pack.sources.filter((item) => item.source_id !== source.source_id),
  source,
];
pack.claims = [...keepNonBook1(pack.claims, "claim_id"), ...claims];
pack.protocolRules = [...keepNonBook1(pack.protocolRules, "rule_id"), ...rules];

// Corroboration adds a citation to a claim that already says the same thing.
// The claim's own wording, status and risk level are never touched.
let corroborated = 0;
const byId = new Map(pack.claims.map((claim) => [claim.claim_id, claim]));
for (const entry of corroborations) {
  const claim = byId.get(entry.claim_id);
  if (!claim)
    throw new Error(`corroboration targets a missing claim: ${entry.claim_id}`);
  const already = claim.source_refs.some(
    (ref) =>
      ref.source_id === source.source_id && ref.locator === entry.locator,
  );
  if (already) continue;
  claim.source_refs = [
    ...claim.source_refs,
    {
      claim_id: claim.claim_id,
      source_id: source.source_id,
      source_snapshot_id: source.source_snapshot_id,
      locator: entry.locator,
      verified_at: entry.verified_at,
    },
  ];
  corroborated += 1;
}

// The existing knowledge is the thing most easily lost here, so its size is
// asserted before anything is written rather than checked afterwards.
const carriedClaims = pack.claims.filter(
  (claim) => !isBook1(claim.claim_id),
).length;
const carriedRules = pack.protocolRules.filter(
  (rule) => !isBook1(rule.rule_id),
).length;
if (
  carriedClaims !== before.claims - claims.length ||
  pack.protocols.length !== before.protocols ||
  pack.protocolOptions.length !== before.protocolOptions ||
  carriedRules !== before.protocolRules - rules.length
)
  throw new Error(
    `merge would drop existing knowledge: claims ${carriedClaims}, protocols ${pack.protocols.length}, options ${pack.protocolOptions.length}, rules ${carriedRules}`,
  );

await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      corpus_files: files.length,
      corpus_sha256: digest,
      qa_records: qaLines.length,
      pages_included: pageMap.included.length,
      book1_claims: claims.length,
      book1_rules: rules.length,
      corroborations_applied: corroborated,
      pack_claims_total: pack.claims.length,
      pack_sources_total: pack.sources.length,
      untouched: {
        protocols: pack.protocols.length === before.protocols,
        protocolOptions: pack.protocolOptions.length === before.protocolOptions,
      },
    },
    null,
    2,
  ),
);
