import { resolve } from "node:path";
import { buildApp } from "./app.js";
import { OidcAuthProvider } from "./auth.js";
try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch {
  // Missing local .env is safe: mock auth and external providers remain disabled.
}
const oidc =
  process.env["AUTH_MODE"] === "oidc" &&
  process.env["OIDC_ISSUER"] &&
  process.env["OIDC_AUDIENCE"] &&
  process.env["OIDC_JWKS_URI"]
    ? new OidcAuthProvider({
        issuer: process.env["OIDC_ISSUER"],
        audience: process.env["OIDC_AUDIENCE"],
        jwksUri: process.env["OIDC_JWKS_URI"],
      })
    : undefined;
const app = await buildApp(oidc ? { authProvider: oidc } : {});
const close = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);
await app.listen({
  host: process.env["API_HOST"] ?? "127.0.0.1",
  port: Number(process.env["API_PORT"] ?? 8080),
});
