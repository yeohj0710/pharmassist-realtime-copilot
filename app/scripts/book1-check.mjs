/**
 * Mechanical checks on the book1 evidence layer. These are the things that
 * cannot be left to a reading: that every citation points at a page the corpus
 * really carries, that nothing approved itself, and that the knowledge which
 * was already in the pack is all still there.
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const corpusDir = resolve("C:/dev/book-corpus/corpus/book1-bogyak");
const pack = JSON.parse(
  await readFile(resolve(root, "data/actual-candidate-pack/pack.json"), "utf8"),
);

// The sizes the pack had before book1 was added. A drop here means the merge
// ate existing knowledge, which is the one failure that cannot be undone by
// re-running anything.
// The field-practice classifier removed 222 indication claims/options that
// came only from secondary words in labels (for example, cold combinations as
// standalone headache products and laxatives as gas products). Keep the new
// safe pack counts exact so the book merge still cannot hide any later loss.
// Protocols went 39 -> 44 when the five no_registered_product protocols started
// shipping instead of being dropped from the pack. They carry zero options and
// zero products, which is why claims and protocolOptions are unchanged: that
// pair staying fixed is the evidence no product was invented to fill the gap.
const BASELINE = { claims: 478, protocols: 44, protocolOptions: 332 };

const failures = [];
const fail = (message) => failures.push(message);

const pageIndex = new Map();
for (const fileName of (await readdir(corpusDir)).filter((n) =>
  n.endsWith(".md"),
)) {
  const text = await readFile(resolve(corpusDir, fileName), "utf8");
  pageIndex.set(
    fileName,
    new Set(
      [...text.matchAll(/<!--\s*p(\d{4})\s*-->/gu)].map((m) =>
        Number.parseInt(m[1], 10),
      ),
    ),
  );
}

const isBook1 = (id) => String(id ?? "").includes("BOOK1");
const book1Claims = pack.claims.filter((c) => isBook1(c.claim_id));
const book1Rules = pack.protocolRules.filter((r) => isBook1(r.rule_id));
const carriedClaims = pack.claims.filter((c) => !isBook1(c.claim_id));
const carriedRules = pack.protocolRules.filter((r) => !isBook1(r.rule_id));

if (carriedClaims.length !== BASELINE.claims)
  fail(
    `existing claims changed: expected ${BASELINE.claims}, found ${carriedClaims.length}`,
  );
if (pack.protocols.length !== BASELINE.protocols)
  fail(
    `protocols changed: expected ${BASELINE.protocols}, found ${pack.protocols.length}`,
  );
if (pack.protocolOptions.length !== BASELINE.protocolOptions)
  fail(
    `protocol options changed: expected ${BASELINE.protocolOptions}, found ${pack.protocolOptions.length}`,
  );

const source = pack.sources.find((s) => s.source_id === "SRC-BOOK1-BOGYAK");
if (!source) fail("SRC-BOOK1-BOGYAK is not registered");
else {
  if (source.official !== false) fail("book1 source claims to be official");
  for (const field of [
    "usage_rights",
    "commercial_use",
    "cache_policy",
    "redistribution",
    "ai_context_use",
  ])
    if (source[field] !== "unknown")
      fail(`book1 source asserts a reuse right it has not confirmed: ${field}`);
}

// Nothing may approve itself. A person does that in apps/reviewer.
for (const item of [...book1Claims, ...book1Rules]) {
  const id = item.claim_id ?? item.rule_id;
  if (item.status === "published" || item.status === "verified")
    fail(`${id} promoted itself to ${item.status}`);
  if (item.review?.pharmacist_approved === true)
    fail(`${id} approved itself as pharmacist-reviewed`);
  if (item.review?.official_source_verified === true)
    fail(`${id} marked itself as verified against an official source`);
}

// Every citation has to land on a page the corpus really carries.
const locatorPattern = /^book1-bogyak\/(.+)#p(\d{4})$/u;
for (const item of [...book1Claims, ...book1Rules]) {
  const id = item.claim_id ?? item.rule_id;
  const refs = item.source_refs ?? [];
  if (refs.length === 0) {
    fail(`${id} cites nothing`);
    continue;
  }
  for (const ref of refs) {
    if (ref.source_id !== "SRC-BOOK1-BOGYAK") continue;
    const match = locatorPattern.exec(ref.locator ?? "");
    if (!match) {
      fail(`${id} has a locator without a page: ${ref.locator}`);
      continue;
    }
    const pages = pageIndex.get(match[1]);
    if (!pages)
      fail(`${id} cites a file the corpus does not have: ${match[1]}`);
    else if (!pages.has(Number.parseInt(match[2], 10)))
      fail(`${id} cites p${match[2]}, which is not in ${match[1]}`);
  }
}

if (pack.verified !== false)
  fail("pack.verified was flipped; approval is a person's decision");

console.log(
  JSON.stringify(
    {
      book1_claims: book1Claims.length,
      book1_rules: book1Rules.length,
      carried_claims: carriedClaims.length,
      carried_rules: carriedRules.length,
      protocols: pack.protocols.length,
      protocol_options: pack.protocolOptions.length,
      failures: failures.length,
    },
    null,
    2,
  ),
);
for (const message of failures) console.error(`FAIL ${message}`);
if (failures.length) process.exitCode = 1;
