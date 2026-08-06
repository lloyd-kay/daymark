import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace") ?? "";
  const result = await workspaceService(workspace, request).schedule({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    employeeId: url.searchParams.get("employeeId") || undefined,
  });
  return noStoreJson(result.body, result.status);
}

export async function PATCH(request: Request) {
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await workspaceService(workspace, request).cancel(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
