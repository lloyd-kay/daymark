import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET(request: Request) {
  const employeeId = new URL(request.url).searchParams.get("employeeId");
  const result = await workspaceService().availability(employeeId);
  return noStoreJson(result.body, result.status);
}

export async function PUT(request: Request) {
  const result = await workspaceService().saveAvailability(await safeJson(request));
  return noStoreJson(result.body, result.status);
}

export async function POST(request: Request) {
  const result = await workspaceService().blockTime(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
