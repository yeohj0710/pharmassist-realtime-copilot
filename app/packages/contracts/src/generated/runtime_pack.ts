/* Generated from runtime_pack.schema.json. Do not edit. */

export interface RuntimePackContract {
  packId: string;
  version: string;
  domain: "human_otc";
  synthetic: boolean;
  clinicalUseProhibited: boolean;
  verified: boolean;
  createdAt: string;
  expiresAt: string;
  sources: SourceSnapshot[];
  ingredients: Ingredient[];
  products: DrugProduct[];
  productIngredients: ProductIngredient[];
  claims: ClinicalClaim[];
  protocols: OTCProtocol[];
  protocolOptions: ProtocolOption[];
  protocolRules: ProtocolRule[];
  cards: {
    cardId: string;
    intent: string;
    domain: "human_otc";
    title: string;
    anchors?: string[];
    aliases: string[];
    keywords: string[];
    sayNow: string[];
    askNext: {
      question: string;
      reason: string;
      priority: number;
      slot: string;
    };
    avoid: string[];
    approved: boolean;
    synthetic: boolean;
    revoked?: boolean;
    expiresAt: string;
  }[];
  publicationRecords?: {
    id: string;
    domain: string;
    trustTier: "A" | "B" | "C" | "D" | "X";
    locator: string;
    approved: boolean;
    medicalSafetyApproved: boolean;
    expiresAt: string;
    conflicted: boolean;
    synthetic: boolean;
  }[];
}
export interface SourceSnapshot {
  source_snapshot_id: string;
  tenant_id?: string | null;
  source_id: string;
  provider:
    | "mfds_easy_drug"
    | "mfds_permit"
    | "mfds_dur_product"
    | "mfds_dur_ingredient"
    | "tenant_pos"
    | "health_kr"
    | "other";
  official: boolean;
  source_url: string;
  fetched_at: string;
  effective_at?: string | null;
  terms_url?: string | null;
  usage_rights: "unrestricted" | "attribution" | "contract_required" | "unknown";
  commercial_use: "allowed" | "contract_required" | "prohibited" | "unknown";
  cache_policy: "allowed" | "contract_required" | "prohibited" | "unknown";
  redistribution: "allowed" | "contract_required" | "prohibited" | "unknown";
  ai_context_use: "allowed" | "contract_required" | "prohibited" | "unknown";
  http_status: number;
  content_sha256: string;
  content_type: string;
  parser_version: string;
  record_count: number;
  page_count?: number;
  next_cursor?: string | null;
  status: "fetched" | "parsed" | "failed" | "superseded";
  raw_retention_policy: "none" | "encrypted_short_term" | "provider_contract";
  uncertainty: string;
}
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
export interface DrugProduct {
  product_id: string;
  display_name: string;
  manufacturer?: string | null;
  jurisdiction: "KR";
  item_seq: string;
  permit_number?: string | null;
  product_code?: string | null;
  otc_status: "otc" | "prescription" | "unknown";
  dosage_form?: string | null;
  route?: string | null;
  permit_status?: string | null;
  supply_performance?: boolean;
  active_ingredients?: {
    ingredient_id: string;
    name: string;
    strength_text: string;
    normalized_amount?: number | null;
    normalized_unit?: string | null;
  }[];
  official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
  official_product_key?: string;
  official_source_url?: string;
  retail_offer?: {
    sku_id: string;
    display_name: string;
    specification: string;
    displayed_price_krw: number;
    recorded_at: string;
    price_status: string;
    image_url?: string | null;
    image_source_url?: string | null;
    image_rights_status?: string | null;
    image_kind?: string | null;
    image_checked_at?: string | null;
  };
  protocol_ids?: string[];
  clinical_group_key?: string;
  indication_summary?: string;
  dosage_summary?: string;
  precaution_summary?: string;
  medication_guide?: string;
  classification_code?: string;
  atc_code?: string;
  kpic_atc?: string;
  storage?: string;
  valid_term?: string;
  insurance?: string;
  interactions?: string[];
  same_ingredient_products?: string[];
  permit_cancelled?: boolean;
  status: "active" | "discontinued" | "withdrawn" | "blocked" | "unknown";
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
  dur_flags?: {
    type: "duplicate" | "age" | "pregnancy" | "coadministration" | "elderly" | "dose" | "duration" | "split" | "other";
    code: string;
    description: string;
    effective_date?: string | null;
    blocking?: boolean;
  }[];
}
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
