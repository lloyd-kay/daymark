import { noStoreJson, safeJson } from "../../../../lib/http";
import { workspaceService } from "../../../../lib/workspace-runtime";

export async function GET() {
  const result = await workspaceService().team();
  return noStoreJson(result.body, result.status);
}

export async function POST(request: Request) {
  const result = await workspaceService().teamAction(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
