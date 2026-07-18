import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import type { RuntimePack } from "@pharmassist/runtime";
import actualPackJson from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import { StatefulConsultFlow } from "./consult-flow.js";
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const profile = import.meta.env["VITE_APP_PROFILE"] ?? "local-demo";
if (profile === "production")
  throw new Error(
    "Production web build requires a pharmacist-approved remote pack; research preview startup blocked.",
  );
const validatedPack = validateContract<RuntimePack>(
  "runtimePack",
  actualPackJson,
);
if (!validatedPack.ok || !validatedPack.value)
  throw new Error("Actual research preview pack failed runtime validation");
const previewPack = validatedPack.value;
const previewFormulary = buildResearchPreviewFormulary(previewPack);
const flow = new StatefulConsultFlow(previewPack, {
  tenantId: "local-research-preview",
  formulary: previewFormulary,
});

self.addEventListener(
  "message",
  (
    event: MessageEvent<RuntimeInput | { type: "reset"; sessionId: string }>,
  ) => {
    if ("type" in event.data && event.data.type === "reset") {
      flow.reset(event.data.sessionId);
      return;
    }
    const input = validateContract<RuntimeInput>("runtimeInput", event.data);
    if (!input.ok || !input.value) {
      self.postMessage({ error: "INVALID_INPUT" });
      return;
    }
    const result = flow.run(input.value);
    const output = validateContract<RuntimeOutput>(
      "runtimeOutput",
      result.output,
    );
    if (!output.ok || !output.value) {
      self.postMessage({ error: "INTERNAL_SAFE_FAILURE" });
      return;
    }
    self.postMessage({ ...result, output: output.value });
  },
);
