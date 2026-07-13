/* Generated from tenant_formulary.schema.json. Do not edit. */

export interface TenantFormulary {
  formulary_id: string;
  tenant_id: string;
  pack_id: string;
  version: string;
  status: "draft" | "active" | "retired";
  coverage_target: number;
  effective_from?: string | null;
  entries: {
    product_id: string;
    ingredient_id: string;
    symptom_category: string;
    active: boolean;
    pharmacist_approved: boolean;
    preferred?: boolean;
    notes?: string;
  }[];
  review: {
    pharmacist_approved: boolean;
    official_source_verified: boolean;
    reviewer_ids?: string[];
    reviewed_at?: string | null;
    expires_at?: string | null;
    notes?: string;
  };
}
