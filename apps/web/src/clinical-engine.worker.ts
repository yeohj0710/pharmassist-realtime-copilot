import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import { LocalClinicalEngine } from "@pharmassist/runtime";
import { syntheticPack } from "@pharmassist/test-fixtures";

const profile = import.meta.env["VITE_APP_PROFILE"] ?? "local-demo";
if (profile === "production")
  throw new Error(
    "Production web build requires a verified remote pack loader; synthetic worker startup blocked.",
  );
const engine = new LocalClinicalEngine(syntheticPack, "local-demo");

self.addEventListener("message", (event: MessageEvent<RuntimeInput>) => {
  const input = validateContract<RuntimeInput>("runtimeInput", event.data);
  if (!input.ok || !input.value) {
    self.postMessage({ error: "INVALID_INPUT" });
    return;
  }
  const result = engine.run(input.value);
  const output = validateContract<RuntimeOutput>(
    "runtimeOutput",
    result.output,
  );
  if (!output.ok || !output.value) {
    self.postMessage({ error: "INTERNAL_SAFE_FAILURE" });
    return;
  }
  self.postMessage({ ...result, output: output.value });
});
