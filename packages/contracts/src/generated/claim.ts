/* Generated from claim.schema.json. Do not edit. */

export interface Claim {
  claim_id: string;
  claim_type:
    | "indication"
    | "dose"
    | "administration"
    | "contraindication"
    | "interaction"
    | "adverse_effect"
    | "red_flag"
    | "referral"
    | "monitoring"
    | "counseling_phrase"
    | "workflow"
    | "product_metadata";
  subject: string;
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
  source_refs: [SourceRef, ...SourceRef[]];
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
export interface SourceRef {
  source_id: string;
  locator: string;
  trust_tier: "A" | "B" | "C" | "D" | "X";
}
