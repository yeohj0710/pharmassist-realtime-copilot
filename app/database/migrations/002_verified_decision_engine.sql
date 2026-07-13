-- Verified OTC decision engine authoring, review, tenant formulary, and pack metadata.
-- Raw provider payloads and patient utterances are intentionally not stored here.

ALTER TABLE knowledge_packs
  ADD COLUMN IF NOT EXISTS pack_id text,
  ADD COLUMN IF NOT EXISTS profile text NOT NULL DEFAULT 'local-demo',
  ADD COLUMN IF NOT EXISTS synthetic boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clinical_use_prohibited boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS entity_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activation_error text;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_packs_tenant_pack_idx
  ON knowledge_packs(tenant_id, pack_id)
  WHERE pack_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS source_snapshots (
  source_snapshot_id text PRIMARY KEY,
  tenant_id text,
  source_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN (
    'mfds_easy_drug','mfds_permit','mfds_dur_product','mfds_dur_ingredient',
    'tenant_pos','health_kr','other'
  )),
  official boolean NOT NULL,
  source_url text NOT NULL,
  terms_url text,
  fetched_at timestamptz NOT NULL,
  effective_at timestamptz,
  usage_rights text NOT NULL,
  commercial_use text NOT NULL,
  cache_policy text NOT NULL,
  redistribution text NOT NULL,
  ai_context_use text NOT NULL,
  http_status integer NOT NULL,
  content_sha256 char(64) NOT NULL,
  content_type text NOT NULL,
  parser_version text NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  page_count integer CHECK (page_count IS NULL OR page_count >= 0),
  next_cursor text,
  status text NOT NULL CHECK (status IN ('fetched','parsed','failed','superseded')),
  raw_retention_policy text NOT NULL,
  uncertainty text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_snapshots_provider_fetched_idx
  ON source_snapshots(provider, fetched_at DESC);
CREATE INDEX IF NOT EXISTS source_snapshots_tenant_fetched_idx
  ON source_snapshots(tenant_id, fetched_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingredients (
  ingredient_id text PRIMARY KEY,
  normalized_name text NOT NULL,
  display_name_ko text NOT NULL,
  display_name_en text,
  mfds_ingredient_code text,
  status text NOT NULL CHECK (status IN ('active','inactive','unknown')),
  source_snapshot_ids jsonb NOT NULL,
  source_refs jsonb NOT NULL,
  review jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ingredients_mfds_code_idx
  ON ingredients(mfds_ingredient_code)
  WHERE mfds_ingredient_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ingredients_normalized_name_idx ON ingredients(normalized_name);

CREATE TABLE IF NOT EXISTS drug_products (
  product_id text PRIMARY KEY,
  item_seq text NOT NULL UNIQUE,
  display_name text NOT NULL,
  manufacturer text,
  jurisdiction char(2) NOT NULL DEFAULT 'KR' CHECK (jurisdiction = 'KR'),
  permit_number text,
  product_code text,
  otc_status text NOT NULL CHECK (otc_status IN ('otc','prescription','unknown')),
  dosage_form text,
  route text,
  permit_status text,
  supply_performance boolean,
  status text NOT NULL CHECK (status IN ('active','discontinued','withdrawn','blocked','unknown')),
  active_ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  dur_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_snapshot_ids jsonb NOT NULL,
  source_refs jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drug_products_status_otc_idx
  ON drug_products(status, otc_status, supply_performance);
CREATE INDEX IF NOT EXISTS drug_products_product_code_idx
  ON drug_products(product_code)
  WHERE product_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_ingredients (
  product_ingredient_id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES drug_products(product_id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  strength_text text NOT NULL,
  normalized_amount numeric,
  normalized_unit text,
  role text NOT NULL CHECK (role IN ('active','salt','combination_component','excipient')),
  is_active boolean NOT NULL,
  source_refs jsonb NOT NULL,
  UNIQUE (product_id, ingredient_id, role, strength_text)
);
CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_idx
  ON product_ingredients(ingredient_id, product_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS clinical_claims (
  claim_id text PRIMARY KEY,
  pack_id text NOT NULL,
  claim_type text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('ingredient','product','protocol','option')),
  subject_id text NOT NULL,
  predicate text NOT NULL,
  object_value jsonb NOT NULL,
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('candidate','conflicted','verified','published','stale','rejected')),
  risk_level text NOT NULL CHECK (risk_level IN ('low','moderate','high','critical')),
  source_refs jsonb NOT NULL,
  conflict_claim_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  review jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinical_claims_pack_status_idx
  ON clinical_claims(pack_id, status, subject_type, subject_id);

CREATE TABLE IF NOT EXISTS otc_protocols (
  protocol_id text PRIMARY KEY,
  pack_id text NOT NULL,
  version text NOT NULL,
  domain text NOT NULL CHECK (domain = 'human_otc'),
  intent text NOT NULL,
  symptom_category text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('candidate','review','published','stale','retired')),
  triggers jsonb NOT NULL,
  option_ids jsonb NOT NULL,
  rule_ids jsonb NOT NULL,
  source_refs jsonb NOT NULL,
  review jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otc_protocols_pack_intent_idx
  ON otc_protocols(pack_id, intent, status, expires_at);

CREATE TABLE IF NOT EXISTS protocol_options (
  option_id text PRIMARY KEY,
  protocol_id text NOT NULL REFERENCES otc_protocols(protocol_id) ON DELETE CASCADE,
  ingredient_id text NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  clinical_priority integer NOT NULL CHECK (clinical_priority BETWEEN 0 AND 100),
  safety_priority integer NOT NULL CHECK (safety_priority BETWEEN 0 AND 100),
  claim_ids jsonb NOT NULL,
  eligibility_rule_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusion_rule_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('candidate','review','published','stale','retired')),
  review jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS protocol_options_protocol_priority_idx
  ON protocol_options(protocol_id, status, clinical_priority DESC, safety_priority DESC);

CREATE TABLE IF NOT EXISTS protocol_rules (
  rule_id text PRIMARY KEY,
  protocol_id text NOT NULL REFERENCES otc_protocols(protocol_id) ON DELETE CASCADE,
  kind text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('present','absent','matches','not_matches','equals','one_of')),
  field text NOT NULL,
  value jsonb,
  effect text NOT NULL CHECK (effect IN ('ask','exclude','refer','select')),
  question text,
  reason text NOT NULL,
  priority integer NOT NULL,
  option_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('candidate','review','published','stale','retired')),
  review jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effect <> 'ask' OR question IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS protocol_rules_protocol_priority_idx
  ON protocol_rules(protocol_id, status, priority);

CREATE TABLE IF NOT EXISTS knowledge_reviews (
  review_id uuid PRIMARY KEY,
  tenant_id text,
  pack_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reviewer_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject','request_changes')),
  official_source_verified boolean NOT NULL,
  reason_code text NOT NULL,
  notes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_reviews_entity_idx
  ON knowledge_reviews(pack_id, entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_pack_entities (
  tenant_id text NOT NULL,
  pack_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_sha256 char(64) NOT NULL,
  review_status text NOT NULL,
  included_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, pack_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS knowledge_pack_entities_pack_idx
  ON knowledge_pack_entities(tenant_id, pack_id, entity_type);

CREATE TABLE IF NOT EXISTS tenant_product_crosswalks (
  tenant_id text NOT NULL,
  tenant_sku text NOT NULL,
  product_id text REFERENCES drug_products(product_id) ON DELETE RESTRICT,
  item_seq text,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('candidate','approved','rejected','unmatched')),
  pharmacist_approved boolean NOT NULL DEFAULT false,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(source_snapshot_id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, tenant_sku)
);
CREATE INDEX IF NOT EXISTS tenant_product_crosswalk_product_idx
  ON tenant_product_crosswalks(tenant_id, product_id) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS tenant_formularies (
  tenant_id text NOT NULL,
  formulary_id text NOT NULL,
  pack_id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','retired')),
  coverage_target numeric NOT NULL CHECK (coverage_target BETWEEN 0.85 AND 0.90),
  effective_from timestamptz,
  review jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, formulary_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_formularies_one_active_idx
  ON tenant_formularies(tenant_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS tenant_formulary_entries (
  tenant_id text NOT NULL,
  formulary_id text NOT NULL,
  product_id text NOT NULL REFERENCES drug_products(product_id) ON DELETE RESTRICT,
  ingredient_id text NOT NULL REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
  symptom_category text NOT NULL,
  active boolean NOT NULL,
  pharmacist_approved boolean NOT NULL,
  preferred boolean NOT NULL DEFAULT false,
  notes text,
  PRIMARY KEY (tenant_id, formulary_id, product_id, ingredient_id, symptom_category),
  FOREIGN KEY (tenant_id, formulary_id)
    REFERENCES tenant_formularies(tenant_id, formulary_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS tenant_formulary_entries_runtime_idx
  ON tenant_formulary_entries(tenant_id, symptom_category, active, pharmacist_approved);

CREATE TABLE IF NOT EXISTS tenant_inventory (
  tenant_id text NOT NULL,
  pack_id text NOT NULL,
  inventory_id text NOT NULL,
  product_id text NOT NULL REFERENCES drug_products(product_id) ON DELETE RESTRICT,
  available_quantity numeric NOT NULL CHECK (available_quantity >= 0),
  status text NOT NULL CHECK (status IN ('in_stock','out_of_stock','unknown')),
  active boolean NOT NULL,
  discontinued boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(source_snapshot_id) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, pack_id, inventory_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_inventory_latest_product_idx
  ON tenant_inventory(tenant_id, pack_id, product_id, observed_at);
CREATE INDEX IF NOT EXISTS tenant_inventory_runtime_idx
  ON tenant_inventory(tenant_id, pack_id, product_id, status, active, discontinued, observed_at DESC);

CREATE TABLE IF NOT EXISTS tenant_sales_aggregates (
  tenant_id text NOT NULL,
  pack_id text NOT NULL,
  product_id text NOT NULL REFERENCES drug_products(product_id) ON DELETE RESTRICT,
  window_start date NOT NULL,
  window_end date NOT NULL,
  units_sold numeric NOT NULL CHECK (units_sold >= 0),
  sales_rank integer NOT NULL CHECK (sales_rank >= 1),
  cumulative_coverage numeric NOT NULL CHECK (cumulative_coverage BETWEEN 0 AND 1),
  symptom_category text NOT NULL,
  source_snapshot_id text NOT NULL REFERENCES source_snapshots(source_snapshot_id) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, pack_id, product_id, window_start, window_end, symptom_category),
  CHECK (window_end >= window_start)
);
CREATE INDEX IF NOT EXISTS tenant_sales_runtime_idx
  ON tenant_sales_aggregates(tenant_id, pack_id, symptom_category, window_end DESC, sales_rank);

CREATE TABLE IF NOT EXISTS consultation_states (
  tenant_id text NOT NULL,
  session_id uuid NOT NULL,
  pack_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  answered_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  asked_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_question_slot text,
  active_protocol_id text,
  active_intent text,
  last_decision_status text CHECK (last_decision_status IN ('recommend','ask','refer','insufficient')),
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, session_id)
);
CREATE INDEX IF NOT EXISTS consultation_states_expiry_idx ON consultation_states(expires_at);

-- Database-side activation guard. Application lint/signature checks remain mandatory.
CREATE OR REPLACE FUNCTION pharmassist_guard_pack_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' AND (
    NEW.synthetic OR NEW.clinical_use_prohibited OR NOT NEW.verified OR
    NEW.expires_at IS NULL OR NEW.expires_at <= now()
  ) THEN
    RAISE EXCEPTION 'synthetic, prohibited, unverified, or expired pack cannot be active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_packs_activation_guard ON knowledge_packs;
CREATE TRIGGER knowledge_packs_activation_guard
BEFORE INSERT OR UPDATE OF status, synthetic, clinical_use_prohibited, verified, expires_at
ON knowledge_packs
FOR EACH ROW EXECUTE FUNCTION pharmassist_guard_pack_activation();
