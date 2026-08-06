import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const defaultRoot = "C:\\dev\\kr-drug-data";
const root = resolve(process.env["KR_DRUG_DATA_DIR"] ?? defaultRoot);

const catalogPaths = {
  "easy-drug": "easy-drug/catalog.jsonl",
  permit: "permit/catalog.jsonl",
  "dur-product": "dur-product/catalog.jsonl",
  "dur-ingredient:usjnt-taboo": "dur-ingredient/usjnt-taboo.jsonl",
  "dur-ingredient:pwnm-taboo": "dur-ingredient/pwnm-taboo.jsonl",
  "dur-ingredient:cpcty-atent": "dur-ingredient/cpcty-atent.jsonl",
  "dur-ingredient:mdctn-pd-atent": "dur-ingredient/mdctn-pd-atent.jsonl",
  "dur-ingredient:odsn-atent": "dur-ingredient/odsn-atent.jsonl",
  "dur-ingredient:spcify-agrde-taboo":
    "dur-ingredient/spcify-agrde-taboo.jsonl",
  "dur-ingredient:efcy-dplct": "dur-ingredient/efcy-dplct.jsonl",
};

const manifestPaths = {
  "easy-drug": "easy-drug/manifest.json",
  permit: "permit/manifest.json",
  "dur-product": "dur-product/manifest.json",
  "dur-ingredient": "dur-ingredient/manifest.json",
};

function catalogPath(dataset) {
  const relative = catalogPaths[dataset];
  if (!relative) throw new Error(`Unknown MFDS local dataset: ${dataset}`);
  return resolve(root, relative);
}

function manifestPath(dataset) {
  const relative = manifestPaths[dataset];
  if (!relative) throw new Error(`Unknown MFDS local manifest: ${dataset}`);
  return resolve(root, relative);
}

export function krDrugDataRoot() {
  return root;
}

export function krDrugCatalogPath(dataset) {
  return catalogPath(dataset);
}

export async function readKrDrugManifest(dataset) {
  const path = manifestPath(dataset);
  await access(path);
  return JSON.parse(await readFile(path, "utf8"));
}

export async function* streamKrDrugDataset(dataset) {
  const stream = createReadStream(catalogPath(dataset), { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

export async function readKrDrugDataset(dataset) {
  const records = [];
  for await (const record of streamKrDrugDataset(dataset)) records.push(record);
  return records;
}

export async function readKrDrugRecordByItemSeq(dataset, itemSeq) {
  const expected = String(itemSeq);
  for await (const record of streamKrDrugDataset(dataset)) {
    if (String(record.itemSeq ?? record.fields?.itemSeq ?? "") === expected)
      return record;
  }
  return null;
}
