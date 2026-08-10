import { isSameOriginMutation } from "../../../../lib/auth/request-security";
import { noStoreJson, safeJson } from "../../../../lib/http";
import { serviceManagement } from "../../../../lib/service-management-runtime";

export async function GET(request: Request) {
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await serviceManagement(workspace, request).list();
  return noStoreJson(result.body, result.status);
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return noStoreJson({ ok: false, error: "Request origin not allowed." }, 403);
  }
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await serviceManagement(workspace, request).mutate(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
