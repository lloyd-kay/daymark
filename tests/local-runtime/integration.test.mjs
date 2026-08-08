import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { Miniflare } from "miniflare";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

test("starts Daymark with persistent local D1 and reports healthy", { timeout: 60_000 }, async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daymark-runtime-integration-"));
  const port = await allocatePort();
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const logDir = path.join(root, "logs");
  const child = spawn(process.execPath, [
    "--import", "tsx",
    "runtime/local/cli.ts", "start",
    "--app-dir", repositoryRoot,
    "--data-dir", dataDir,
    "--backup-dir", backupDir,
    "--log-dir", logDir,
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

  const backup = await runCli([
    "backup",
    "--app-dir", repositoryRoot,
    "--data-dir", dataDir,
    "--backup-dir", backupDir,
    "--log-dir", logDir,
  ]);
  assert.equal(backup.code, 0, backup.stderr);
  const backupSummary = JSON.parse(backup.stdout);
  assert.equal(backupSummary.integrity, "verified");
  assert.match(backupSummary.manifestFile, /\.json$/);
});

test("repairs default availability after a partial initial seed", { timeout: 60_000 }, async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "daymark-runtime-partial-seed-"));
  const port = await allocatePort();
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const logDir = path.join(root, "logs");
  const migration = await runCli([
    "migrate",
    "--app-dir", repositoryRoot,
    "--data-dir", dataDir,
    "--backup-dir", backupDir,
    "--log-dir", logDir,
  ]);
  assert.equal(migration.code, 0, migration.stderr);

  const databaseRuntime = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Persist: path.join(dataDir, "v3", "d1"),
    d1Databases: { DB: "00000000-0000-4000-8000-000000000000" },
  });
  try {
    const database = await databaseRuntime.getD1Database("DB");
    await database.prepare(`
      insert into employee_profiles
        (id, workspace_id, membership_id, public_name, title, bio, accent, active, sort_order)
      values
        ('maya-chen', 'workspace-daymark', null, 'Maya Chen', 'Client partner', '', 'coral', true, 0),
        ('theo-brooks', 'workspace-daymark', null, 'Theo Brooks', 'Operations specialist', '', 'sage', true, 1),
        ('priya-shah', 'workspace-daymark', null, 'Priya Shah', 'Project adviser', '', 'lilac', true, 2),
        ('jon-bell', 'workspace-daymark', null, 'Jon Bell', 'Team coordinator', '', 'ochre', true, 3)
    `).run();
  } finally {
    await databaseRuntime.dispose();
  }

  const child = spawn(process.execPath, [
    "--import", "tsx",
    "runtime/local/cli.ts", "start",
    "--app-dir", repositoryRoot,
    "--data-dir", dataDir,
    "--backup-dir", backupDir,
    "--log-dir", logDir,
    "--port", String(port),
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, DAYMARK_SETUP_CODE: "INTEGRATION-SETUP-CODE" },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  let stdout = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  context.after(async () => stopAndClean(child, root));

  const lines = createInterface({ input: child.stdout });
  await Promise.race([
    once(lines, "line"),
    once(child, "exit").then(([code]) => { throw new Error(`Runtime exited ${code}: ${stderr}`); }),
  ]);
  const response = await fetch(`http://127.0.0.1:${port}/api/public/daymark/slots?employeeId=maya-chen&from=${nextMondayDateKey()}`);
  const responseText = await response.text();
  assert.equal(response.status, 200, `${responseText}\n${stdout}\n${stderr}`);
  const result = JSON.parse(responseText);
  assert.ok(result.slots.length > 0, "the partial seed should regain default bookable times");
});

async function runCli(args) {
  const child = spawn(process.execPath, ["--import", "tsx", "runtime/local/cli.ts", ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, DAYMARK_SETUP_CODE: "INTEGRATION-SETUP-CODE" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "exit");
  return { code, stdout: stdout.trim(), stderr };
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate test port");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

function nextMondayDateKey() {
  const date = new Date();
  const daysUntilMonday = ((8 - date.getUTCDay()) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
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
