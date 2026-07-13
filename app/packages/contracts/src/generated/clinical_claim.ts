/* Generated from clinical_claim.schema.json. Do not edit. */

export interface ClinicalClaim {
  claim_id: string;
  pack_id: string;
  claim_type:
    | "indication"
    | "administration"
    | "contraindication"
    | "interaction"
    | "adverse_effect"
    | "red_flag"
    | "referral"
    | "monitoring"
    | "product_metadata"
    | "workflow";
  subject_type: "ingredient" | "product" | "protocol" | "option";
  subject_id: string;
  predicate: string;
  object: unknown;
  qualifiers?: {
    [k: string]: unknown;
  };
  status: "candidate" | "conflicted" | "verified" | "published" | "stale" | "rejected";
  risk_level: "low" | "moderate" | "high" | "critical";
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
  conflict_claim_ids?: string[];
  review: {
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    reviewer_ids?: string[];
    reviewed_at?: string | null;
    expires_at?: string | null;
    notes?: string;
  };
}
