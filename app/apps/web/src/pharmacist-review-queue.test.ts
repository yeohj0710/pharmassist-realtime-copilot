import { describe, expect, it } from "vitest";
import actualPack from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import reviewQueue from "../../../data/actual-candidate-pack/pharmacist-review-queue.json" with { type: "json" };
import reviewAreas from "../../../data/clinical-pathways/pharmacist-review-areas.json" with { type: "json" };

const sourceIds = new Set(actualPack.sources.map((source) => source.source_id));
const protocolById = new Map(
  actualPack.protocols.map((protocol) => [protocol.protocol_id, protocol]),
);

describe("pharmacist review queue", () => {
  it("covers every declared review area", () => {
    expect(reviewAreas.areas).toHaveLength(6);
    expect(reviewQueue.areaCount).toBe(reviewAreas.areas.length);
    for (const area of reviewAreas.areas) {
      const items = reviewQueue.items.filter(
        (item) => item.areaId === area.areaId,
      );
      expect(items.length, area.areaId).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.mustConfirm, item.itemId).toEqual(area.mustConfirm);
        expect(item.whyReviewNeeded, item.itemId).toBe(area.whyReviewNeeded);
      }
    }
  });

  // The whole point of the queue is that it hands work to a pharmacist. If
  // generation could mark anything approved, the queue would be laundering an
  // unreviewed claim into an approved one.
  it("approves nothing by generating", () => {
    expect(reviewQueue.items.length).toBeGreaterThan(0);
    for (const item of reviewQueue.items) {
      expect(item.status, item.itemId).toBe("pending");
      expect(item.decision, item.itemId).toBeNull();
      expect(item.reviewerId, item.itemId).toBeNull();
      expect(item.reviewedAt, item.itemId).toBeNull();
    }
    expect(reviewQueue.countByStatus).toEqual({
      pending: reviewQueue.items.length,
    });
  });

  it("keeps the pack itself unapproved while the queue is outstanding", () => {
    expect(reviewQueue.clinicalUseProhibited).toBe(true);
    expect(actualPack.clinicalUseProhibited).toBe(true);
    expect(actualPack.verified).toBe(false);
    const approvedProtocols = actualPack.protocols.filter(
      (protocol) => protocol.review?.pharmacist_approved === true,
    );
    expect(approvedProtocols).toEqual([]);
  });

  it("gives every item real wording, a registered source, and a live protocol", () => {
    for (const item of reviewQueue.items) {
      const protocol = protocolById.get(item.protocolId);
      expect(protocol, item.itemId).toBeDefined();
      expect(item.protocolName, item.itemId).toBe(protocol?.display_name);

      expect(item.reviewTargets.length, item.itemId).toBeGreaterThan(0);
      for (const target of item.reviewTargets) {
        expect(typeof target.text, item.itemId).toBe("string");
        expect(
          target.text.trim().length,
          `${item.itemId} ${target.field}`,
        ).toBeGreaterThan(0);
      }

      // A locator a pharmacist cannot open is not a citation.
      const sourceId = item.sourceLocator.split("#")[0] ?? "";
      expect(
        sourceIds.has(sourceId),
        `${item.itemId} ${item.sourceLocator}`,
      ).toBe(true);

      const product = actualPack.products.find(
        (candidate) => candidate.product_id === item.productId,
      );
      expect(product, item.itemId).toBeDefined();
      expect(item.productName, item.itemId).toBe(product?.display_name);
    }
  });

  it("carries the referral red flags a reviewer has to judge against", () => {
    for (const item of reviewQueue.items) {
      expect(item.referRedFlags.length, item.itemId).toBeGreaterThan(0);
      const referRule = actualPack.protocolRules.find(
        (rule) =>
          rule.protocol_id === item.protocolId && rule.effect === "refer",
      );
      expect(item.referRedFlags, item.itemId).toEqual(referRule?.value);
    }
  });
});
