import { getAccountSession } from "../../../../../lib/auth/membership";
import { isSameOriginMutation } from "../../../../../lib/auth/request-security";
import { acceptWorkspaceInvitation } from "../../../../../lib/auth/staff-accounts";
import { noStoreJson, safeJson } from "../../../../../lib/http";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
  }
  const session = await getAccountSession(request);
  if (!session) return noStoreJson({ ok: false, error: "Sign in is required." }, 401);
  const body = await safeJson(request);
  const code = body && typeof body === "object"
    ? (body as Record<string, unknown>).code
    : null;
  if (typeof code !== "string" || code.length < 20 || code.length > 200) {
    return invalidInvitation();
  }
  const accepted = await acceptWorkspaceInvitation(code, session);
  return accepted
    ? noStoreJson({ ok: true, workspaceSlug: accepted.workspaceSlug }, 200)
    : invalidInvitation();
}

function invalidInvitation() {
  return noStoreJson({
    ok: false,
    error: "This invitation is invalid, expired, already used, or belongs to another account.",
  }, 400);
}
