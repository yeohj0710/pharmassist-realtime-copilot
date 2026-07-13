import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";
import {
  lintForPublication,
  signPayload,
  verifyPayload,
  type Signed,
} from "@pharmassist/knowledge";
import { syntheticPack } from "@pharmassist/test-fixtures";

const root = resolve(import.meta.dirname, "../../..");
const outputDir = resolve(root, "data/generated-dev-pack");
const publicKeyPath = resolve(root, "config/dev-pack-public-key.pem");
const signedPath = resolve(outputDir, "pack.signed.json");

const records = syntheticPack.cards.map((card) => ({
  id: card.cardId,
  domain: card.domain,
  trustTier: "B" as const,
  locator: `synthetic://fixture/${card.cardId}`,
  approved: true,
  medicalSafetyApproved: true,
  expiresAt: card.expiresAt,
  conflicted: false,
  synthetic: true,
}));

async function buildDev(): Promise<void> {
  const errors = lintForPublication(records, "local-demo");
  if (errors.length) throw new Error(errors.join("\n"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const payload = {
    ...syntheticPack,
    clinicalUseProhibited: true as const,
  };
  const signed = signPayload(payload, privateKey, "dev-ephemeral-1");
  await mkdir(outputDir, { recursive: true });
  await mkdir(resolve(root, "config"), { recursive: true });
  await writeFile(signedPath, `${JSON.stringify(signed, null, 2)}\n`, "utf8");
  await writeFile(
    publicKeyPath,
    publicKey.export({ type: "spki", format: "pem" }),
    { mode: 0o644 },
  );
  console.log(
    `built ${signedPath}; private key discarded; CLINICAL USE PROHIBITED`,
  );
}

async function verifyDev(): Promise<void> {
  const signed = JSON.parse(await readFile(signedPath, "utf8")) as Signed<
    typeof syntheticPack
  >;
  const key = createPublicKey(await readFile(publicKeyPath));
  if (
    !verifyPayload(signed, key) ||
    !signed.payload.synthetic ||
    !signed.payload.clinicalUseProhibited
  )
    throw new Error("dev pack verification failed");
  console.log(`verified ${signed.payload.version} ${signed.sha256}`);
}

const command = process.argv[2] ?? "lint";
if (command === "lint") {
  const errors = lintForPublication(records, "local-demo");
  if (errors.length) throw new Error(errors.join("\n"));
  const productionErrors = lintForPublication(records, "production");
  if (!productionErrors.every((error) => error.endsWith(":PRODUCTION_POLICY")))
    throw new Error("synthetic production gate not enforced");
  console.log(
    `linted ${records.length} records; production synthetic gate enforced`,
  );
} else if (command === "build-dev") await buildDev();
else if (command === "verify") await verifyDev();
else throw new Error(`unknown command: ${command}`);
