import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";

export const ADMIN_COOKIE_NAME = "idai_admin_token";
const TOKEN_ISSUER = "idai-stores-43";
const TOKEN_AUDIENCE = "idai-admin";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

export type AdminRole = "SuperAdmin" | "Manager" | "Support";
export type AdminAccessLevel = "View Only" | "Editor" | "Full Access";

export type AdminTokenPayload = JWTPayload & {
  email: string;
  role: AdminRole;
  accessLevel: AdminAccessLevel;
  name: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminToken(input: {
  id: string;
  email: string;
  role: AdminRole;
  accessLevel?: AdminAccessLevel;
  name?: string;
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    role: input.role,
    accessLevel: input.accessLevel ?? accessLevelForLegacyRole(input.role),
    name: input.name ?? input.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.id)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || !isAdminRole(payload.role)) {
      return null;
    }

    return {
      ...payload,
      email: payload.email,
      role: payload.role,
      accessLevel: isAdminAccessLevel(payload.accessLevel)
        ? payload.accessLevel
        : accessLevelForLegacyRole(payload.role),
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name : payload.email,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("AUTH_SECRET")) {
      throw error;
    }
    return null;
  }
}

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "SuperAdmin" || role === "Manager" || role === "Support";
}

export function isAdminAccessLevel(level: unknown): level is AdminAccessLevel {
  return level === "View Only" || level === "Editor" || level === "Full Access";
}

export function accessLevelForLegacyRole(role: AdminRole): AdminAccessLevel {
  if (role === "SuperAdmin") return "Full Access";
  if (role === "Manager") return "Editor";
  return "View Only";
}

export function legacyRoleForAccessLevel(accessLevel: AdminAccessLevel): AdminRole {
  if (accessLevel === "Full Access") return "SuperAdmin";
  if (accessLevel === "Editor") return "Manager";
  return "Support";
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: TOKEN_TTL_SECONDS,
};
