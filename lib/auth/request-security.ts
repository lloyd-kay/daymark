import { hashOpaqueValue } from "./password";

const SESSION_COOKIE = "daymark_session";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sessionTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=") || null;
  }

  return null;
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function isSameOriginMutation(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === publicRequestOrigin(request);
  } catch {
    return false;
  }
}

export async function requestFingerprintHash(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  return hashOpaqueValue(`${ip}\n${userAgent}`);
}

function publicRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = firstForwardedValue(request.headers.get("x-forwarded-host"))
    ?? request.headers.get("host")
    ?? url.host;
  const protocol = firstForwardedValue(request.headers.get("x-forwarded-proto"))
    ?? url.protocol.slice(0, -1);
  return new URL(`${protocol}://${host}`).origin;
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0].trim() || null;
}
