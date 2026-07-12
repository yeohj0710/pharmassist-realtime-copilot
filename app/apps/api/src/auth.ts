import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type Role = "pharmacist" | "reviewer" | "publisher" | "admin";
export interface VerifiedIdentity {
  readonly subject: string;
  readonly role: Role;
  readonly tenant: string;
}
export interface AuthProvider {
  authenticate(request: FastifyRequest): Promise<VerifiedIdentity | undefined>;
}
export interface OidcConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUri: string;
}
const roles: readonly Role[] = ["pharmacist", "reviewer", "publisher", "admin"];

export class OidcAuthProvider implements AuthProvider {
  readonly jwks;
  constructor(private readonly config: OidcConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri));
  }
  async authenticate(
    request: FastifyRequest,
  ): Promise<VerifiedIdentity | undefined> {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) return undefined;
    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ["RS256", "ES256"],
      });
      const role = payload["role"];
      const tenant = payload["tenant_id"];
      if (
        typeof payload.sub !== "string" ||
        typeof role !== "string" ||
        !roles.includes(role as Role) ||
        typeof tenant !== "string" ||
        !/^[a-z0-9_-]{1,64}$/iu.test(tenant)
      )
        return undefined;
      return { subject: payload.sub, role: role as Role, tenant };
    } catch {
      return undefined;
    }
  }
}
