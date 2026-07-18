/* Generated from protocol_option.schema.json. Do not edit. */

export interface ProtocolOption {
  option_id: string;
  protocol_id: string;
  ingredient_id: string;
  display_name: string;
  clinical_priority: number;
  safety_priority: number;
  therapeutic_role?: "preferred" | "alternative" | "conditional";
  evidence_scope?: "direct" | "supportive" | "phenotype_specific";
  fit_rationale?: string;
  /**
   * @minItems 1
   */
  claim_ids: [string, ...string[]];
  eligibility_rule_ids?: string[];
  exclusion_rule_ids?: string[];
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
