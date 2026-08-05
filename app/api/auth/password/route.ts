import { authService } from "../../../../lib/auth/runtime";
import {
  isSameOriginMutation,
  sessionCookie,
  sessionTokenFromRequest,
} from "../../../../lib/auth/request-security";
import { noStoreJson, safeJson } from "../../../../lib/http";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbidden();
  const body = await safeJson(request);
  if (!isPasswordBody(body)) {
    return noStoreJson({ ok: false, error: "Check the password details." }, 400);
  }
  if (body.password !== body.confirmation) {
    return noStoreJson({ ok: false, error: "Passwords do not match." }, 400);
  }
  const token = sessionTokenFromRequest(request);
  if (!token) {
    return noStoreJson({ ok: false, error: "Sign in is required." }, 401);
  }

  const result = await authService().changePassword(token, body.password);
  const response = noStoreJson(result.body, result.status);
  if (result.session) {
    response.headers.append(
      "Set-Cookie",
      sessionCookie(result.session.token, new Date(result.session.expiresAt)),
    );
  }
  return response;
}

function isPasswordBody(value: unknown): value is {
  password: string;
  confirmation: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.password === "string"
    && typeof body.confirmation === "string";
}

function forbidden() {
  return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
}
