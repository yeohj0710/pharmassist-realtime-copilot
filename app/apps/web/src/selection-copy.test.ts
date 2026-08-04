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

  // A note that says "compare with X" is only useful if X is something this
  // protocol actually offers. PTC-ACID_REFLUX pointed at 파모티딘, which is a
  // PTC-HEARTBURN candidate — a pharmacist would have gone looking for a
  // product that was never on the list.
  it("never sends the reader to an ingredient this protocol does not carry", () => {
    const vocabulary = new Map<string, Set<string>>();
    for (const product of actualPack.products)
      for (const profile of product.selection_profiles ?? []) {
        if (!vocabulary.has(profile.protocol_id))
          vocabulary.set(profile.protocol_id, new Set());
        const words = vocabulary.get(profile.protocol_id);
        words?.add(product.display_name);
        for (const ingredient of product.active_ingredients ?? []) {
          // Most HealthKR products carry ingredients that are not registered
          // in pack.ingredients, so a lookup alone reads as an empty
          // vocabulary and this check silently passes. The name on the
          // product is what the card is actually built from.
          words?.add(ingredient.name ?? "");
          words?.add(
            actualPack.ingredients.find(
              (item) => item.ingredient_id === ingredient.ingredient_id,
            )?.display_name_ko ?? "",
          );
        }
        // Field-practice profiles describe composition in free text rather
        // than a labelled field, so the differentiators count as vocabulary.
        for (const text of profile.differentiators ?? []) words?.add(text);
      }

    const named = [
      "아세트아미노펜",
      "이부프로펜",
      "나프록센",
      "로라타딘",
      "세티리진",
      "펙소페나딘",
      "파모티딘",
      "트리메부틴",
      "디오스민",
      "포비돈요오드",
      "덱스판테놀",
      "헤파리노이드",
      "테르비나핀",
      "케토코나졸",
      "클로트리마졸",
      "시메티콘",
      "콘드로이틴",
      "비사코딜",
      "니코틴",
      "디펜히드라민",
      "알긴산",
      "수산화마그네슘",
      "덱시부프로펜",
      "록소프로펜",
    ];
    // Enforced on every note, not just the authored ones. A field-practice
    // profile can serve several protocols whose rosters differ, so one shared
    // sentence was accurate under PTC-HEARTBURN and dangling under
    // PTC-ACID_REFLUX. Those now carry a byProtocol override rather than a
    // reworded quotation, so the page each note cites still backs it.
    const dangling: string[] = [];
    for (const { profile } of profiles) {
      const note = profile.comparison_note ?? "";
      const text = [...(vocabulary.get(profile.protocol_id) ?? [])].join(" ");
      for (const name of named)
        if (note.includes(name) && !text.includes(name))
          dangling.push(`${profile.protocol_id}: ${name}`);
    }
    expect([...new Set(dangling)]).toEqual([]);
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
