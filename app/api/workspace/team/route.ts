import { isSameOriginMutation } from "../../../../lib/auth/request-security";
import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET() {
  const result = await workspaceService().team();
  return noStoreJson(result.body, result.status);
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
  }
  const result = await workspaceService().teamAction(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
