import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import claimSchema from "../schemas/claim.schema.json" with { type: "json" };
import consultationCardSchema from "../schemas/consultation_card.schema.json" with { type: "json" };
import drugProductSchema from "../schemas/drug_product.schema.json" with { type: "json" };
import errorEnvelopeSchema from "../schemas/error_envelope.schema.json" with { type: "json" };
import feedbackSchema from "../schemas/feedback.schema.json" with { type: "json" };
import packManifestSchema from "../schemas/pack_manifest.schema.json" with { type: "json" };
import refinementRequestSchema from "../schemas/refinement_request.schema.json" with { type: "json" };
import runtimeInputSchema from "../schemas/runtime_input.schema.json" with { type: "json" };
import runtimeOutputSchema from "../schemas/runtime_output.schema.json" with { type: "json" };
import sourceRecordSchema from "../schemas/source_record.schema.json" with { type: "json" };

export type ContractName =
  | "claim"
  | "consultationCard"
  | "drugProduct"
  | "errorEnvelope"
  | "feedback"
  | "packManifest"
  | "refinementRequest"
  | "runtimeInput"
  | "runtimeOutput"
  | "sourceRecord";

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
for (const schema of [runtimeInputSchema, runtimeOutputSchema])
  ajv.addSchema(schema);

const validators: Readonly<Record<ContractName, ValidateFunction>> = {
  claim: ajv.compile(claimSchema),
  consultationCard: ajv.compile(consultationCardSchema),
  drugProduct: ajv.compile(drugProductSchema),
  errorEnvelope: ajv.compile(errorEnvelopeSchema),
  feedback: ajv.compile(feedbackSchema),
  packManifest: ajv.compile(packManifestSchema),
  refinementRequest: ajv.compile(refinementRequestSchema),
  runtimeInput: ajv.getSchema(runtimeInputSchema.$id)!,
  runtimeOutput: ajv.getSchema(runtimeOutputSchema.$id)!,
  sourceRecord: ajv.compile(sourceRecordSchema),
};

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
