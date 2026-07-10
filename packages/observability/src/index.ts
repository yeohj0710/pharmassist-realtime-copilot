export interface AuditEvent {
  readonly event_name: string;
  readonly timestamp: string;
  readonly request_id?: string;
  readonly sequence?: number;
  readonly domain?: string;
  readonly card_id?: string;
  readonly rule_ids?: readonly string[];
  readonly knowledge_version?: string;
  readonly model_id?: string;
  readonly latency_bucket?: string;
  readonly status_code?: number;
  readonly error_code?: string;
  readonly reason_codes?: readonly string[];
}
const allowed = new Set([
  "event_name",
  "timestamp",
  "request_id",
  "sequence",
  "domain",
  "card_id",
  "rule_ids",
  "knowledge_version",
  "model_id",
  "latency_bucket",
  "status_code",
  "error_code",
  "reason_codes",
]);
const forbidden =
  /raw|text|transcript|audio|patient|phone|address|resident|medication|prompt|output_body|sdp/iu;
export function serializeAudit(input: AuditEvent): string {
  for (const key of Object.keys(input))
    if (!allowed.has(key) || forbidden.test(key))
      throw new Error(`OBSERVABILITY_FIELD_REJECTED:${key}`);
  return JSON.stringify(input);
}
export class MemoryAuditSink {
  readonly lines: string[] = [];
  write(event: AuditEvent): void {
    this.lines.push(serializeAudit(event));
  }
}
