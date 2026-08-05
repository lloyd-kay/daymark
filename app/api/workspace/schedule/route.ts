import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await workspaceService().schedule({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    employeeId: url.searchParams.get("employeeId") || undefined,
  });
  return noStoreJson(result.body, result.status);
}

export async function PATCH(request: Request) {
  const result = await workspaceService().cancel(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
