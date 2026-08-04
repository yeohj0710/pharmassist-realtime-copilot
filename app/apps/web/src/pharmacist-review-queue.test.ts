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

      // What the item cites depends on where the wording came from, not on
      // which pass produced the item.
      if (
        item.origin === "field_practice_pdf" ||
        // Rewritten to fit one protocol's roster rather than quoted, but the
        // page still backs the clinical content, so it keeps the locator.
        item.origin === "field_practice_scoped"
      ) {
        // A locator a pharmacist cannot open is not a citation.
        const sourceId = item.sourceLocator?.split("#")[0] ?? "";
        expect(
          sourceIds.has(sourceId),
          `${item.itemId} ${item.sourceLocator}`,
        ).toBe(true);
      } else {
        // Written text. Claiming a source page would be worse than admitting
        // there is none.
        expect(item.origin, item.itemId).toBe("authored_contrast");
        expect(item.sourceLocator, item.itemId).toBeNull();
      }

      if (item.kind === "clinical_area") {
        const product = actualPack.products.find(
          (candidate) => candidate.product_id === item.productId,
        );
        expect(product, item.itemId).toBeDefined();
        expect(item.productName, item.itemId).toBe(product?.display_name);
      } else {
        const affected = item.affectedProducts ?? [];
        expect(affected.length, item.itemId).toBeGreaterThan(0);
        for (const name of affected)
          expect(
            actualPack.products.some(
              (candidate) => candidate.display_name === name,
            ),
            `${item.itemId} ${name}`,
          ).toBe(true);
      }
    }
  });

  it("puts every authored card sentence in front of a pharmacist", () => {
    const copyItems = reviewQueue.items.filter(
      (item) => item.kind === "selection_copy",
    );
    expect(copyItems.length).toBeGreaterThanOrEqual(103);
    // Every comparison note the pack shows should be one of these, or it
    // reached a card without anyone agreeing to it.
    const queued = new Set(
      copyItems.flatMap((item) =>
        item.reviewTargets
          .filter((target) => target.field === "comparison_note")
          .map((target) => target.text),
      ),
    );
    const shown = new Set(
      actualPack.products.flatMap((product) =>
        (product.selection_profiles ?? []).map(
          (profile) => profile.comparison_note,
        ),
      ),
    );
    const unreviewed = [...shown].filter(
      (note) =>
        typeof note === "string" && note.length > 0 && !queued.has(note),
    );
    // What remains is field-practice wording, which the clinical-area items
    // already cover.
    const fieldPracticeNotes = new Set(
      reviewQueue.items
        .filter((item) => item.kind === "clinical_area")
        .flatMap((item) =>
          item.reviewTargets
            .filter((target) => target.field === "comparison_note")
            .map((target) => target.text),
        ),
    );
    expect(unreviewed.filter((note) => !fieldPracticeNotes.has(note))).toEqual(
      [],
    );
  });

  // Wording nobody ever read is the one kind that should not survive. Either it
  // was quoted from the PDF, scoped from it on purpose, or written on purpose.
  it("leaves no card sentence that only a build step has seen", () => {
    const generated = reviewQueue.items.filter(
      (item) => item.origin === "pipeline_generated",
    );
    expect(
      generated.map(
        (item) =>
          `${item.protocolId}: ${item.reviewTargets[0]?.text.slice(0, 40)}`,
      ),
    ).toEqual([]);
  });

  it("carries the referral red flags a reviewer has to judge against", () => {
    for (const item of reviewQueue.items) {
      expect(item.referRedFlags.length, item.itemId).toBeGreaterThan(0);
      // Every referral term of the protocol, not just the first rule's — a
      // reviewer judges the wording against all of them.
      const terms: string[] = [];
      for (const rule of actualPack.protocolRules)
        // Some refer rules carry a single string rather than a list; iterating
        // that would collect its characters.
        if (
          rule.protocol_id === item.protocolId &&
          rule.effect === "refer" &&
          Array.isArray(rule.value)
        )
          for (const term of rule.value)
            if (!terms.includes(term)) terms.push(term);
      expect(item.referRedFlags, item.itemId).toEqual(terms);
    }
  });
});
