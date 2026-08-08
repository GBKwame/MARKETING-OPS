import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "marketops-production-super-secret-jwt-key-2026",
);

const COOKIE_NAME = "mo_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "super_admin" | "admin" | "manager" | "marketer";
  branchId?: string | null;
  supervisorId?: string | null;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  const isProd = process.env.NODE_ENV === "production";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
}

export function buildClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
}

export function getSessionFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )\\s*${COOKIE_NAME}\\s*=\\s*([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
