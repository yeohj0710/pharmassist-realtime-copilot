/**
 * 식약처 DUR 성분정보의 병용금기를 팩 성분에 맞춰 후보로 뽑는다.
 *
 * 4,851건 중 이 팩에 닿는 것은 19건뿐이다. 낮아 보이지만 구조적으로 그렇다.
 * DUR 성분 데이터는 전문의약품이 대부분이고 이 팩은 일반의약품이다. OTC 쪽
 * DUR(임부금기 등)은 이미 HealthKR 레지스트리를 통해 118개 제품에 붙어 있다.
 * 이 스크립트는 그 위에 병용금기만 얹는다.
 *
 * 결과는 후보 파일로만 쓴다. 팩을 직접 고치지 않는다.
 */
import {
  createReadStream,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const durDir = "C:/dev/kr-drug-data/dur-ingredient";
const pack = JSON.parse(
  readFileSync(resolve(root, "data/actual-candidate-pack/pack.json"), "utf8"),
);

const norm = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s·ㆍ・]/gu, "")
    .trim();
// 염·수화물 접미사만 걷어낸다. 성분을 다른 성분으로 바꾸지 않는 범위다.
const stem = (value) =>
  norm(value).replace(
    /(염산염|말레산염|시트르산염|브롬화수소산염|황산염|질산염|타르타르산염|아세테이트|나트륨|칼슘|칼륨|수화물|무수물|무수|제피|농축분말)+$/gu,
    "",
  );

const ingredientByStem = new Map();
for (const ingredient of pack.ingredients) {
  if (!ingredient.display_name_ko) continue;
  const key = stem(ingredient.display_name_ko);
  if (key.length < 3 || ingredientByStem.has(key)) continue;
  ingredientByStem.set(key, ingredient);
}

const productsByIngredientId = new Map();
for (const product of pack.products)
  for (const active of product.active_ingredients ?? []) {
    if (!productsByIngredientId.has(active.ingredient_id))
      productsByIngredientId.set(active.ingredient_id, []);
    productsByIngredientId.get(active.ingredient_id).push(product);
  }

const findings = [];
let scanned = 0;
for (const file of readdirSync(durDir).filter((name) =>
  name.endsWith(".jsonl"),
)) {
  const lines = createInterface({
    input: createReadStream(`${durDir}/${file}`),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const fields = record.fields ?? {};
    scanned += 1;
    if (fields.TYPE_NAME !== "병용금기") continue;
    const ours = ingredientByStem.get(stem(fields.INGR_KOR_NAME));
    if (!ours) continue;
    const counterpart = fields.MIXTURE_INGR_KOR_NAME;
    if (!counterpart) continue;
    findings.push({
      ingredientId: ours.ingredient_id,
      ingredientName: ours.display_name_ko,
      counterpartKo: counterpart,
      counterpartEn: fields.MIXTURE_INGR_ENG_NAME ?? null,
      prohibitionContent: fields.PROHBT_CONTENT ?? null,
      notificationDate: fields.NOTIFICATION_DATE ?? null,
      ingredientCode: fields.INGR_CODE ?? null,
      affectedProducts: (
        productsByIngredientId.get(ours.ingredient_id) ?? []
      ).map((product) => ({
        productId: product.product_id,
        displayName: product.display_name,
      })),
    });
  }
}

const output = {
  schemaVersion: "1.0.0",
  candidateOnly: true,
  clinicalUseProhibited: true,
  generatedAt: new Date().toISOString(),
  source: {
    dataset: "MFDS DUR 성분정보 (DURIrdntInfoService03)",
    localPath: durDir,
    scannedRecords: scanned,
  },
  // 이 숫자가 낮은 것은 결함이 아니다. 근거는 파일 머리말에 적어두었다.
  matchedIngredients: new Set(findings.map((item) => item.ingredientId)).size,
  findings,
};
writeFileSync(
  resolve(root, "data/actual-candidate-pack/mfds-dur-interactions.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    scanned,
    findings: findings.length,
    ingredients: output.matchedIngredients,
    products: new Set(
      findings.flatMap((f) => f.affectedProducts.map((p) => p.productId)),
    ).size,
  }),
);
