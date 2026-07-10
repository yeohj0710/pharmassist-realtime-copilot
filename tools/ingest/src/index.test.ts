import { describe, expect, it } from "vitest";
import {
  assertImportSize,
  assertProductionAdapter,
  secureImportPath,
} from "./index.js";
describe("ingest boundary", () => {
  it("rejects traversal and unsafe file types", () => {
    expect(() => secureImportPath("C:/safe", "../secret.json")).toThrow(
      "traversal",
    );
    expect(() => secureImportPath("C:/safe", "payload.zip")).toThrow(
      "unsupported",
    );
  });
  it("bounds size", () => {
    expect(() => assertImportSize(21 * 1024 * 1024)).toThrow("size");
  });
  it("requires official licensed adapters", () => {
    expect(() =>
      assertProductionAdapter({
        id: "mock",
        official: false,
        licenseRecorded: false,
        fetch: async () => ({}),
      }),
    ).toThrow("official");
  });
});
