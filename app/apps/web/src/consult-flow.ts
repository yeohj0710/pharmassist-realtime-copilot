import type {
  ConsultationState,
  RuntimeInput,
  TenantFormulary,
  TenantInventory,
  TenantSalesAggregate,
} from "@pharmassist/contracts";
import {
  LocalClinicalEngine,
  type EngineResult,
  type RuntimePack,
} from "@pharmassist/runtime";

export interface ConsultTenantContext {
  readonly tenantId: string;
  readonly formulary?: TenantFormulary;
  /** `undefined` means that the tenant has no inventory integration. */
  readonly inventory?: readonly TenantInventory[];
  readonly sales?: readonly TenantSalesAggregate[];
}

/**
 * Thin session adapter around the deterministic engine. It persists only
 * structured ConsultationState; it never concatenates prior chat text or
 * creates drug/ingredient suggestions outside the active pack.
 */
export class StatefulConsultFlow {
  private readonly engine: LocalClinicalEngine;
  private readonly sessions = new Map<string, ConsultationState>();

  constructor(
    pack: RuntimePack,
    private readonly tenant: ConsultTenantContext = { tenantId: "local-demo" },
  ) {
    this.engine = new LocalClinicalEngine(pack, "local-demo");
  }

  reset(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  run(input: RuntimeInput): EngineResult {
    const prior = this.sessions.get(input.session_id);
    const result = this.engine.run(input, {
      tenantId: this.tenant.tenantId,
      ...(this.tenant.formulary ? { formulary: this.tenant.formulary } : {}),
      ...(this.tenant.inventory !== undefined
        ? { inventory: this.tenant.inventory }
        : {}),
      ...(this.tenant.sales ? { sales: this.tenant.sales } : {}),
      ...(prior ? { consultationState: prior } : {}),
    });
    this.sessions.set(input.session_id, result.consultationState);
    return result;
  }
}
