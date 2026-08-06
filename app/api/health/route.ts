import { env } from "cloudflare:workers";

import { DAYMARK_VERSION, readRuntimeHealth, type HealthDatabase, type RuntimeHealth } from "../../../lib/runtime-health";

function response(body: RuntimeHealth, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    const health = await readRuntimeHealth(env.DB as HealthDatabase);
    return response(health, health.status === "ok" ? 200 : 503);
  } catch {
    return response({
      status: "needs_migration",
      appVersion: DAYMARK_VERSION,
      latestMigration: null,
    }, 503);
  }
}
