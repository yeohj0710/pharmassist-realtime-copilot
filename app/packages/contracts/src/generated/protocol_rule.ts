/* Generated from protocol_rule.schema.json. Do not edit. */

export interface ProtocolRule {
  rule_id: string;
  protocol_id: string;
  kind: "required_slot" | "exclusion_pattern" | "referral_pattern" | "selection_pattern";
  operator: "present" | "absent" | "matches" | "not_matches" | "equals" | "one_of";
  field: string;
  value?: unknown;
  effect: "ask" | "exclude" | "refer" | "select";
  question?: string | null;
  reason: string;
  priority: number;
  option_ids?: string[];
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
  status: "candidate" | "review" | "published" | "stale" | "retired";
  review: {
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    reviewer_ids?: string[];
    reviewed_at?: string | null;
    expires_at?: string | null;
    notes?: string;
  };
}
