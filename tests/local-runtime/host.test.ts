import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { waitForHealth } from "../../runtime/local/host";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("waitForHealth", () => {
  it("returns only after the real endpoint reports ok", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(requests === 1 ? 503 : 200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        status: requests === 1 ? "needs_migration" : "ok",
        appVersion: "0.1.0",
        latestMigration: "0002_daymark_company_workspaces.sql",
      }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    const health = await waitForHealth(`http://127.0.0.1:${address.port}/api/health`, {
      timeoutMs: 1_000,
      intervalMs: 10,
    });

    expect(health.status).toBe("ok");
    expect(requests).toBe(2);
  });

  it("times out without returning a non-ok response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "needs_migration", appVersion: "0.1.0", latestMigration: null }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");

    await expect(waitForHealth(`http://127.0.0.1:${address.port}/api/health`, {
      timeoutMs: 40,
      intervalMs: 5,
    })).rejects.toThrow("Daymark did not become healthy within 40ms");
  });
});
