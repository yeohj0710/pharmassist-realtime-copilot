/* Generated from ingredient.schema.json. Do not edit. */

export interface Ingredient {
  ingredient_id: string;
  display_name_ko: string;
  display_name_en?: string | null;
  normalized_name: string;
  mfds_ingredient_code?: string | null;
  status: "active" | "inactive" | "unknown";
  /**
   * @minItems 1
   */
  source_snapshot_ids: [string, ...string[]];
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
}
