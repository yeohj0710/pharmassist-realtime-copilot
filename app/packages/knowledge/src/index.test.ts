import { syntheticPack } from "@pharmassist/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  compileDecisionPack,
  lintDecisionPack,
  lintForPublication,
} from "./index.js";
import {
  AtomicPackStore,
  canonicalJson,
  createDevKeys,
  signPayload,
  verifyPayload,
} from "./node.js";

describe("knowledge lifecycle", () => {
  it("canonicalizes, signs, detects tampering, activates and rolls back", () => {
    const keys = createDevKeys();
    const one = signPayload(
      { version: "1", cards: [1] },
      keys.privateKey,
      "dev",
    );
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(verifyPayload(one, keys.publicKey)).toBe(true);
    const store = new AtomicPackStore<{ version: string; cards: number[] }>(
      keys.publicKey,
      (payload) => payload.version,
    );
    store.activate(one, () => true);
    store.activate(
      signPayload({ version: "2", cards: [2] }, keys.privateKey, "dev"),
      () => true,
    );
    expect(store.rollback().payload.version).toBe("1");
  });

  it("fails production synthetic, trust, conflict, review and expiry gates", () => {
    const errors = lintForPublication(
      [
        {
          id: "x",
          domain: "animal_medicine",
          trustTier: "C",
          locator: "PLACEHOLDER",
          approved: false,
          medicalSafetyApproved: false,
          expiresAt: "2020-01-01T00:00:00Z",
          conflicted: true,
          synthetic: true,
        },
      ],
      "production",
    );
    expect(errors.length).toBeGreaterThanOrEqual(6);
  });

  it("blocks synthetic or unresolved-rights decision packs in production", () => {
    const syntheticErrors = lintDecisionPack(
      syntheticPack,
      "production",
      new Date("2026-07-13T00:00:00Z"),
    );
    expect(syntheticErrors).toContain("PACK_SYNTHETIC");
    expect(syntheticErrors).toContain("PACK_CLINICAL_USE_PROHIBITED");
    expect(syntheticErrors).toContain("PACK_NOT_VERIFIED");

    const unresolved = {
      ...syntheticPack,
      synthetic: false,
      clinicalUseProhibited: false,
      verified: true,
      sources: syntheticPack.sources.map((source) => ({
        ...source,
        official: true,
        usage_rights: "unknown" as const,
      })),
    };
    expect(
      lintDecisionPack(
        unresolved,
        "production",
        new Date("2026-07-13T00:00:00Z"),
      ).some((error) => error.includes("USAGE_RIGHTS_UNRESOLVED")),
    ).toBe(true);
  });

  it("compiles deterministic entity ordering only after all gates pass", () => {
    const compiled = compileDecisionPack(
      syntheticPack,
      "local-demo",
      new Date("2026-07-13T00:00:00Z"),
    );
    expect(compiled.protocols.map((item) => item.protocol_id)).toEqual(
      [...compiled.protocols]
        .map((item) => item.protocol_id)
        .sort((left, right) => left.localeCompare(right)),
    );
  });

  it("never rolls back to a revoked pack and clears an unsafe active pack", () => {
    const keys = createDevKeys();
    const store = new AtomicPackStore<{ version: string; cards: number[] }>(
      keys.publicKey,
      (payload) => payload.version,
    );
    store.activate(
      signPayload({ version: "1", cards: [1] }, keys.privateKey, "dev"),
      () => true,
    );
    store.activate(
      signPayload({ version: "2", cards: [2] }, keys.privateKey, "dev"),
      () => true,
    );
    store.revoke("1");
    expect(() => store.rollback()).toThrow("No verified rollback pack");
    expect(store.active?.payload.version).toBe("2");
    expect(() => store.revoke("2")).toThrow("No verified rollback pack");
    expect(store.active).toBeUndefined();
  });
});
