/* Generated from source_snapshot.schema.json. Do not edit. */

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
