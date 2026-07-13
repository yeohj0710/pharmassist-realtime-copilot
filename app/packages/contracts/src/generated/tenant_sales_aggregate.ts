/* Generated from tenant_sales_aggregate.schema.json. Do not edit. */

export interface TenantSalesAggregate {
  tenant_id: string;
  pack_id: string;
  product_id: string;
  window_start: string;
  window_end: string;
  units_sold: number;
  sales_rank: number;
  cumulative_coverage: number;
  symptom_category: string;
  source_snapshot_id: string;
}
