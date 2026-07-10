BEGIN;
CREATE TABLE IF NOT EXISTS knowledge_packs (
  tenant_id text NOT NULL,
  version text NOT NULL,
  manifest_sha256 char(64) NOT NULL,
  signature text NOT NULL,
  key_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('candidate','active','revoked','rolled_back')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
CREATE TABLE IF NOT EXISTS coded_feedback (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  request_id uuid NOT NULL,
  outcome_code text NOT NULL,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx ON audit_events(tenant_id, created_at DESC);
COMMIT;
