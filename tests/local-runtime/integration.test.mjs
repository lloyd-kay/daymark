import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

test("starts Daymark with persistent local D1 and reports healthy", { timeout: 60_000 }, async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daymark-runtime-integration-"));
  const port = await allocatePort();
  const child = spawn(process.execPath, [
    "--import", "tsx",
    "runtime/local/cli.ts", "start",
    "--app-dir", repositoryRoot,
    "--data-dir", path.join(root, "data"),
    "--backup-dir", path.join(root, "backups"),
    "--log-dir", path.join(root, "logs"),
    "--port", String(port),
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, DAYMARK_SETUP_CODE: "INTEGRATION-SETUP-CODE" },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  context.after(async () => stopAndClean(child, root));

  const lines = createInterface({ input: child.stdout });
  const ready = await Promise.race([
    once(lines, "line").then(([line]) => JSON.parse(line)),
    once(child, "exit").then(([code]) => { throw new Error(`Runtime exited ${code}: ${stderr}`); }),
  ]);
  assert.equal(ready.status, "running");

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    appVersion: "0.1.0",
    latestMigration: "0002_daymark_company_workspaces.sql",
  });
});

async function allocatePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate test port");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForExit(child, timeoutMs) {
  let timer;
  const stopped = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
  ]);
  if (timer) clearTimeout(timer);
  return stopped;
}

async function stopAndClean(child, root) {
  child.stdin.end("stop\n");
  const stopped = await waitForExit(child, 5_000);
  if (!stopped) {
    if (process.platform === "win32") {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      await once(killer, "exit");
    } else {
      child.kill("SIGKILL");
    }
  }
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (!stopped) throw new Error("Runtime did not stop after receiving the stop command");
}
