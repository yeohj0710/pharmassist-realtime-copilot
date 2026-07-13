/* Generated from product_ingredient.schema.json. Do not edit. */

export interface ProductIngredient {
  product_ingredient_id: string;
  product_id: string;
  ingredient_id: string;
  strength_text: string;
  normalized_amount?: number | null;
  normalized_unit?: string | null;
  role?: "active" | "excipient" | "unknown";
  is_active: boolean;
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
}
