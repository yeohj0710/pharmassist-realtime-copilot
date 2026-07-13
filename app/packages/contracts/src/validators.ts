import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import claimSchema from "../schemas/claim.schema.json" with { type: "json" };
import clinicalClaimSchema from "../schemas/clinical_claim.schema.json" with { type: "json" };
import consultationCardSchema from "../schemas/consultation_card.schema.json" with { type: "json" };
import consultationStateSchema from "../schemas/consultation_state.schema.json" with { type: "json" };
import drugProductSchema from "../schemas/drug_product.schema.json" with { type: "json" };
import errorEnvelopeSchema from "../schemas/error_envelope.schema.json" with { type: "json" };
import feedbackSchema from "../schemas/feedback.schema.json" with { type: "json" };
import ingredientSchema from "../schemas/ingredient.schema.json" with { type: "json" };
import otcProtocolSchema from "../schemas/otc_protocol.schema.json" with { type: "json" };
import packManifestSchema from "../schemas/pack_manifest.schema.json" with { type: "json" };
import productIngredientSchema from "../schemas/product_ingredient.schema.json" with { type: "json" };
import protocolOptionSchema from "../schemas/protocol_option.schema.json" with { type: "json" };
import protocolRuleSchema from "../schemas/protocol_rule.schema.json" with { type: "json" };
import recommendationDecisionSchema from "../schemas/recommendation_decision.schema.json" with { type: "json" };
import refinementRequestSchema from "../schemas/refinement_request.schema.json" with { type: "json" };
import runtimeInputSchema from "../schemas/runtime_input.schema.json" with { type: "json" };
import runtimeOutputSchema from "../schemas/runtime_output.schema.json" with { type: "json" };
import runtimePackSchema from "../schemas/runtime_pack.schema.json" with { type: "json" };
import sourceRecordSchema from "../schemas/source_record.schema.json" with { type: "json" };
import sourceSnapshotSchema from "../schemas/source_snapshot.schema.json" with { type: "json" };
import tenantFormularySchema from "../schemas/tenant_formulary.schema.json" with { type: "json" };
import tenantInventorySchema from "../schemas/tenant_inventory.schema.json" with { type: "json" };
import tenantSalesAggregateSchema from "../schemas/tenant_sales_aggregate.schema.json" with { type: "json" };

const schemaDocuments = {
  claim: claimSchema,
  clinicalClaim: clinicalClaimSchema,
  consultationCard: consultationCardSchema,
  consultationState: consultationStateSchema,
  drugProduct: drugProductSchema,
  errorEnvelope: errorEnvelopeSchema,
  feedback: feedbackSchema,
  ingredient: ingredientSchema,
  otcProtocol: otcProtocolSchema,
  packManifest: packManifestSchema,
  productIngredient: productIngredientSchema,
  protocolOption: protocolOptionSchema,
  protocolRule: protocolRuleSchema,
  recommendationDecision: recommendationDecisionSchema,
  refinementRequest: refinementRequestSchema,
  runtimeInput: runtimeInputSchema,
  runtimeOutput: runtimeOutputSchema,
  runtimePack: runtimePackSchema,
  sourceRecord: sourceRecordSchema,
  sourceSnapshot: sourceSnapshotSchema,
  tenantFormulary: tenantFormularySchema,
  tenantInventory: tenantInventorySchema,
  tenantSalesAggregate: tenantSalesAggregateSchema,
} as const;

export type ContractName = keyof typeof schemaDocuments;

export interface ValidationResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly errors: readonly ErrorObject[];
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
ajv.addFormat(
  "uuid",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
);
ajv.addFormat("date", /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u);
ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value,
    ) && Number.isFinite(Date.parse(value)),
});
ajv.addFormat("uri", {
  type: "string",
  validate: (value: string) => {
    try {
      const parsed = new URL(value);
      return Boolean(parsed.protocol && parsed.hostname);
    } catch {
      return false;
    }
  },
});

for (const schema of Object.values(schemaDocuments)) ajv.addSchema(schema);

const validators = Object.fromEntries(
  Object.entries(schemaDocuments).map(([name, schema]) => {
    const validator = ajv.getSchema(schema.$id);
    if (!validator) throw new Error(`Contract schema not registered: ${name}`);
    return [name, validator];
  }),
) as Readonly<Record<ContractName, ValidateFunction>>;

export function validateContract<T>(
  name: ContractName,
  input: unknown,
): ValidationResult<T> {
  const validate = validators[name];
  if (validate(input)) return { ok: true, value: input as T, errors: [] };
  return { ok: false, errors: [...(validate.errors ?? [])] };
}

export const runtimeInputSchemaDocument: Readonly<Record<string, unknown>> =
  runtimeInputSchema;
export const runtimeOutputSchemaDocument: Readonly<Record<string, unknown>> =
  runtimeOutputSchema;
export const recommendationDecisionSchemaDocument: Readonly<
  Record<string, unknown>
> = recommendationDecisionSchema;
