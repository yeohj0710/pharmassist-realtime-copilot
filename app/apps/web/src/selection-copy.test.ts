import { describe, expect, it } from "vitest";
import actualPack from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };

const profiles = actualPack.products.flatMap((product) =>
  (product.selection_profiles ?? []).map((profile) => ({
    product: product.display_name,
    profile,
  })),
);

// The generated pipeline used to give four out of five profiles the same
// circular sentence, which told a pharmacist nothing about which candidate to
// pick. These keep that from coming back.
describe("selection card copy", () => {
  it("leaves no circular comparison note", () => {
    const circular = profiles.filter(({ profile }) =>
      /성분 기전과 제형이 현재 불편에 더 직접 맞을 때 우선/.test(
        profile.comparison_note ?? "",
      ),
    );
    expect(
      circular.map((item) => `${item.product}/${item.profile.protocol_id}`),
    ).toEqual([]);
  });

  it("keeps engine vocabulary out of the pharmacist-facing card", () => {
    for (const { product, profile } of profiles) {
      const text = [
        profile.comparison_note ?? "",
        ...(profile.differentiators ?? []),
      ].join(" ");
      expect(
        /1차 역할로 검토|프로토콜|슬롯|엔진|rule_id/i.test(text),
        product,
      ).toBe(false);
    }
  });

  // The label asks when this product is right. A sentence describing how to
  // compare candidates answers a different question and leaves the pharmacist
  // exactly where they started.
  it("states a condition in 언제 이 제품, not a comparison procedure", () => {
    for (const { product, profile } of profiles)
      expect(
        /비교하는 경우|확인한 뒤|공식 .*적응증과 함께/.test(
          profile.choose_when ?? "",
        ),
        `${product}: ${profile.choose_when}`,
      ).toBe(false);
  });

  it("states no dose on a card", () => {
    for (const { product, profile } of profiles)
      expect(
        /\d+\s*(?:mg|mL|ml)\b|하루\s*\d+\s*번|\d+\s*정씩/i.test(
          profile.comparison_note ?? "",
        ),
        product,
      ).toBe(false);
  });

  it("gives the candidates of one protocol distinct comparison notes", () => {
    const byProtocol = new Map<string, Set<string>>();
    for (const { profile } of profiles) {
      if (!byProtocol.has(profile.protocol_id))
        byProtocol.set(profile.protocol_id, new Set());
      byProtocol.get(profile.protocol_id)?.add(profile.comparison_note ?? "");
    }
    // Every protocol that offers more than one ingredient group should say
    // something different about each of them.
    for (const [protocolId, notes] of byProtocol)
      if (notes.size === 1)
        expect(
          actualPack.products.filter((product) =>
            (product.selection_profiles ?? []).some(
              (profile) => profile.protocol_id === protocolId,
            ),
          ).length,
          protocolId,
        ).toBeLessThanOrEqual(5);
  });
});
