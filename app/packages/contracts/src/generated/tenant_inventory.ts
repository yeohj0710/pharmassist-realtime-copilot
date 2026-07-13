/* Generated from tenant_inventory.schema.json. Do not edit. */

export interface TenantInventory {
  inventory_id: string;
  tenant_id: string;
  pack_id: string;
  product_id: string;
  available_quantity: number;
  status: "in_stock" | "out_of_stock" | "unknown";
  active: boolean;
  discontinued: boolean;
  observed_at: string;
  source_snapshot_id: string;
}
