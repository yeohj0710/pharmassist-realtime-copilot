import { describe, expect, it } from "vitest";
import {
  AtomicPackStore,
  canonicalJson,
  createDevKeys,
  lintForPublication,
  signPayload,
  verifyPayload,
} from "./index.js";
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
      (p) => p.version,
    );
    store.activate(one, () => true);
    store.activate(
      signPayload({ version: "2", cards: [2] }, keys.privateKey, "dev"),
      () => true,
    );
    expect(store.rollback().payload.version).toBe("1");
  });
  it("fails production synthetic/tier/conflict gates", () => {
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
