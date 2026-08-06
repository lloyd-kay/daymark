import { env } from "cloudflare:workers";
import { authService } from "../../../../lib/auth/runtime";
import {
  isSameOriginMutation,
  sessionCookie,
} from "../../../../lib/auth/request-security";
import { noStoreJson, safeJson } from "../../../../lib/http";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return forbidden();
  const body = await safeJson(request);
  if (!isSetupBody(body)) {
    return noStoreJson({ ok: false, error: "Check the setup details." }, 400);
  }

  const result = await authService().setup(body, env.DAYMARK_SETUP_CODE ?? "");
  return authResponse(result);
}

function isSetupBody(value: unknown): value is {
  setupCode: string;
  workspaceName: string;
  workspaceSlug: string;
  displayName: string;
  email: string;
  password: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.setupCode === "string"
    && typeof body.workspaceName === "string"
    && typeof body.workspaceSlug === "string"
    && typeof body.displayName === "string"
    && typeof body.email === "string"
    && typeof body.password === "string";
}

function authResponse(result: Awaited<ReturnType<ReturnType<typeof authService>["setup"]>>) {
  const response = noStoreJson(result.body, result.status);
  if (result.session) {
    response.headers.append(
      "Set-Cookie",
      sessionCookie(result.session.token, new Date(result.session.expiresAt)),
    );
  }
  return response;
}

function forbidden() {
  return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
}
