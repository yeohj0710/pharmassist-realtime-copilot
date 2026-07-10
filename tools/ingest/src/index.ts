import { extname, resolve, sep } from "node:path";
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export function secureImportPath(root: string, candidate: string): string {
  if (candidate.includes("\0")) throw new Error("NUL path rejected");
  const base = resolve(root);
  const target = resolve(base, candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`))
    throw new Error("path traversal rejected");
  if (![".json", ".jsonl", ".csv"].includes(extname(target).toLowerCase()))
    throw new Error("unsupported import type");
  return target;
}
export function assertImportSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_IMPORT_BYTES)
    throw new Error("import size rejected");
}
export interface SourceAdapter {
  readonly id: string;
  readonly official: boolean;
  readonly licenseRecorded: boolean;
  fetch(signal: AbortSignal): Promise<unknown>;
}
export function assertProductionAdapter(adapter: SourceAdapter): void {
  if (!adapter.official || !adapter.licenseRecorded)
    throw new Error("official source/license gate required");
}
