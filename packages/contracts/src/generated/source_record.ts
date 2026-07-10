/* Generated from source_record.schema.json. Do not edit. */

export interface SourceRecord {
  source_id: string;
  title: string;
  domain:
    "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine" | "operations" | "marketing" | "unknown";
  trust_tier: "A" | "B" | "C" | "D" | "X";
  runtime_policy:
    "publishable" | "candidate_only" | "metadata_only" | "admin_only" | "separate_domain" | "quarantine" | "excluded";
  jurisdiction?: string | null;
  published_at?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  sha256: string;
  locator?: string | null;
  copyright: {
    redistribution_allowed: boolean;
    notes: string;
  };
  review: {
    status: "inventoried" | "extracted" | "reviewed" | "verified" | "published" | "stale" | "retired";
    reviewer_ids: string[];
    claim_level_verification_required: boolean;
    notes?: string;
  };
}
