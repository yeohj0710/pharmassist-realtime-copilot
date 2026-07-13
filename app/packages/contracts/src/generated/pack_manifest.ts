/* Generated from pack_manifest.schema.json. Do not edit. */

export interface PackManifest {
  pack_version: string;
  schema_version: string;
  min_app_version: string;
  domain: "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine";
  synthetic: boolean;
  clinical_use_prohibited: boolean;
  created_at: string;
  approved_at?: string | null;
  expires_at: string;
  counts: {
    cards: number;
    claims: number;
    sources: number;
    products: number;
    ingredients: number;
    product_ingredients: number;
    protocols: number;
    protocol_options: number;
    protocol_rules: number;
  };
  files: {
    path: string;
    sha256: string;
    bytes: number;
  }[];
  golden_suite_version?: string;
  prompt_registry_version?: string;
  sha256: string;
  signature: {
    algorithm: "Ed25519";
    key_id: string;
    value: string;
  };
  revoked_card_ids?: string[];
}
