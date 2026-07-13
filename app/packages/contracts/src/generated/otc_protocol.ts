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
   * @minItems 1
   */
  option_ids: [string, ...string[]];
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
