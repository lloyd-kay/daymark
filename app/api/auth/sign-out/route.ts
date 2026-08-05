import { authService } from "../../../../lib/auth/runtime";
import {
  clearSessionCookie,
  isSameOriginMutation,
  sessionTokenFromRequest,
} from "../../../../lib/auth/request-security";
import { noStoreJson } from "../../../../lib/http";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return withClearedSession(forbidden());
  const token = sessionTokenFromRequest(request);
  let result = { status: 200, body: { ok: true } };
  if (token) {
    try {
      result = await authService().signOut(token);
    } catch {
      return withClearedSession(
        noStoreJson(
          { ok: false, error: "Sign out could not be completed." },
          500,
        ),
      );
    }
  }
  return withClearedSession(noStoreJson(result.body, result.status));
}

function forbidden() {
  return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
}

function withClearedSession(response: Response) {
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
