import { authService } from "../../../../lib/auth/runtime";
import {
  isSameOriginMutation,
  requestFingerprintHash,
  sessionCookie,
} from "../../../../lib/auth/request-security";
import { noStoreJson, safeJson } from "../../../../lib/http";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbidden();
  const body = await safeJson(request);
  if (!isSignInBody(body)) {
    return noStoreJson({ ok: false, error: "Check your sign-in details." }, 400);
  }

  const result = await authService().signIn(body, await requestFingerprintHash(request));
  const response = noStoreJson(result.body, result.status);
  if (result.session) {
    response.headers.append(
      "Set-Cookie",
      sessionCookie(result.session.token, new Date(result.session.expiresAt)),
    );
  }
  return response;
}

function isSignInBody(value: unknown): value is { email: string; password: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.email === "string" && typeof body.password === "string";
}

function forbidden() {
  return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
}
