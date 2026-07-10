import {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { PharmassistError } from "@pharmassist/domain";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
export const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export interface Signed<T> {
  readonly payload: T;
  readonly sha256: string;
  readonly signature: string;
  readonly keyId: string;
}
export function signPayload<T>(
  payload: T,
  privateKey: KeyObject,
  keyId: string,
): Signed<T> {
  const canonical = canonicalJson(payload);
  return {
    payload,
    sha256: sha256(canonical),
    signature: sign(null, Buffer.from(canonical), privateKey).toString(
      "base64",
    ),
    keyId,
  };
}
export function verifyPayload<T>(
  signed: Signed<T>,
  publicKey: KeyObject,
): boolean {
  const canonical = canonicalJson(signed.payload);
  return (
    sha256(canonical) === signed.sha256 &&
    verify(
      null,
      Buffer.from(canonical),
      publicKey,
      Buffer.from(signed.signature, "base64"),
    )
  );
}
export const createDevKeys = () => generateKeyPairSync("ed25519");

export interface PublicationRecord {
  readonly id: string;
  readonly domain: string;
  readonly trustTier: "A" | "B" | "C" | "D" | "X";
  readonly locator: string;
  readonly approved: boolean;
  readonly medicalSafetyApproved: boolean;
  readonly expiresAt: string;
  readonly conflicted: boolean;
  readonly synthetic: boolean;
}
export function lintForPublication(
  records: readonly PublicationRecord[],
  profile: "local-demo" | "production",
  now = new Date(),
): readonly string[] {
  const errors: string[] = [];
  for (const item of records) {
    if (item.domain !== "human_otc") errors.push(`${item.id}:DOMAIN_LEAK`);
    if (!item.locator || /placeholder|replace_with/iu.test(item.locator))
      errors.push(`${item.id}:LOCATOR_INVALID`);
    if (!item.approved || !item.medicalSafetyApproved)
      errors.push(`${item.id}:APPROVAL_MISSING`);
    if (item.conflicted) errors.push(`${item.id}:CONFLICTED`);
    if (new Date(item.expiresAt) <= now) errors.push(`${item.id}:EXPIRED`);
    if (
      profile === "production" &&
      (item.synthetic || !["A", "B"].includes(item.trustTier))
    )
      errors.push(`${item.id}:PRODUCTION_POLICY`);
  }
  return errors;
}

export class AtomicPackStore<T> {
  #active: Signed<T> | undefined;
  #history: Signed<T>[] = [];
  #revoked = new Set<string>();
  #smoke: (payload: T) => boolean = () => false;
  constructor(
    private readonly publicKey: KeyObject,
    private readonly versionOf: (payload: T) => string,
  ) {}
  activate(next: Signed<T>, smoke: (payload: T) => boolean): void {
    if (
      !verifyPayload(next, this.publicKey) ||
      !smoke(next.payload) ||
      this.#revoked.has(this.versionOf(next.payload))
    )
      throw new PharmassistError(
        "KNOWLEDGE_STALE",
        "Knowledge pack verification failed.",
        false,
        "previous_pack",
      );
    if (this.#active) this.#history.unshift(this.#active);
    this.#history = this.#history.slice(0, 3);
    this.#smoke = smoke;
    this.#active = next;
  }
  rollback(): Signed<T> {
    const current = this.#active;
    while (this.#history.length) {
      const prior = this.#history.shift();
      if (!prior) break;
      const version = this.versionOf(prior.payload);
      if (
        this.#revoked.has(version) ||
        !verifyPayload(prior, this.publicKey) ||
        !this.#smoke(prior.payload)
      )
        continue;
      if (
        current &&
        !this.#revoked.has(this.versionOf(current.payload)) &&
        verifyPayload(current, this.publicKey) &&
        this.#smoke(current.payload)
      )
        this.#history.unshift(current);
      this.#active = prior;
      return prior;
    }
    if (
      !current ||
      this.#revoked.has(this.versionOf(current.payload)) ||
      !verifyPayload(current, this.publicKey) ||
      !this.#smoke(current.payload)
    )
      this.#active = undefined;
    throw new PharmassistError(
      "KNOWLEDGE_STALE",
      "No verified rollback pack.",
      false,
      "none",
    );
  }
  revoke(version: string): void {
    this.#revoked.add(version);
    if (this.#active && this.versionOf(this.#active.payload) === version)
      this.rollback();
  }
  get active(): Signed<T> | undefined {
    return this.#active;
  }
  get retained(): number {
    return this.#history.length;
  }
}
