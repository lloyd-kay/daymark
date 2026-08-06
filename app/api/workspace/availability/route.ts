import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET(request: Request) {
  const employeeId = new URL(request.url).searchParams.get("employeeId");
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await workspaceService(workspace, request).availability(employeeId);
  return noStoreJson(result.body, result.status);
}

export async function PUT(request: Request) {
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await workspaceService(workspace, request).saveAvailability(await safeJson(request));
  return noStoreJson(result.body, result.status);
}

export async function POST(request: Request) {
  const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
  const result = await workspaceService(workspace, request).blockTime(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
