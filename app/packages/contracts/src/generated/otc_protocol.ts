/* Generated from otc_protocol.schema.json. Do not edit. */

export interface OTCProtocol {
  protocol_id: string;
  pack_id: string;
  version: string;
  domain: "human_otc";
  intent: string;
  symptom_category: string;
  display_name: string;
  status: "candidate" | "review" | "published" | "stale" | "retired";
  triggers: {
    anchors: string[];
    aliases: string[];
    keywords: string[];
    negative?: string[];
  };
  /**
   * Empty only for a protocol the official product registry has no product for. Such a protocol still ships so it claims its own utterances instead of letting a neighbouring protocol absorb them and recommend that neighbour's products; the empty option set is what keeps it from recommending anything. The pack build rejects an empty option set for any protocol not explicitly marked no_registered_product.
   *
   * @minItems 0
   */
  option_ids: string[];
  rule_ids: string[];
  /**
   * @minItems 1
   */
  source_refs: [
    {
      claim_id: string;
      source_id: string;
      source_snapshot_id: string;
      locator: string;
      verified_at: string;
    },
    ...{
      claim_id: string;
      source_id: string;
      source_snapshot_id: string;
      locator: string;
      verified_at: string;
    }[]
  ];
  review: {
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    reviewer_ids?: string[];
    reviewed_at?: string | null;
    expires_at?: string | null;
    notes?: string;
  };
  expires_at: string;
}
