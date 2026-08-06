# Daymark Local Runtime and Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the existing Daymark Worker locally with persistent D1-compatible storage, safe migrations and backups, then package the same host for Docker Compose.

**Architecture:** A small Node service host launches the repository-pinned Wrangler/workerd runtime against the existing built Worker and a loopback-only port. All lifecycle operations use one typed command runner, while health, migrations, and verified SQL backups stay independently testable. Docker runs that same host with a named data volume rather than introducing a second database implementation.

**Tech Stack:** Node.js 22.23.1, TypeScript 5.9, Wrangler 4.92, workerd/Miniflare through Wrangler, Cloudflare D1, Vitest 4, Docker Compose.

## Global Constraints

- Preserve the existing Cloudflare Worker and `DB` D1 binding behaviour.
- Bind the local server to `127.0.0.1` by default; do not publish a router port automatically.
- Store mutable state outside versioned application files.
- Never log setup codes, tunnel tokens, administrator credentials, appointment contact details, or database contents.
- Apply every committed migration in filename order before serving requests.
- A failed migration or failed backup verification must leave the previous data intact.
- Temporary public access is implemented by the Windows Control plan, not this runtime.
- Existing privacy, company-isolation, authentication, booking, retention, and rendered-route tests must continue to pass.

---

## File map

- `runtime/local/contracts.ts`: shared configuration, health, command, backup, and status types.
- `runtime/local/paths.ts`: resolves Windows, Linux, test, and Docker data paths.
- `runtime/local/process.ts`: redacted subprocess execution with structured results.
- `runtime/local/wrangler.ts`: builds exact Wrangler migration, export, and dev commands.
- `runtime/local/migrations.ts`: applies and verifies the committed migration chain.
- `runtime/local/backups.ts`: exports, hashes, manifests, and verifies backups.
- `runtime/local/host.ts`: starts the loopback Worker and exposes lifecycle events.
- `runtime/local/cli.ts`: stable command-line entry point used by service, desktop app, and Docker.
- `app/api/health/route.ts`: narrow loopback health response.
- `Dockerfile`, `compose.yaml`, `.dockerignore`: container route using the same host.
- `tests/local-runtime/*.test.ts`: unit and integration coverage for each boundary.

### Task 1: Runtime contracts, paths, and redacted process runner

**Files:**
- Create: `runtime/local/contracts.ts`
- Create: `runtime/local/paths.ts`
- Create: `runtime/local/process.ts`
- Create: `tests/local-runtime/paths.test.ts`
- Create: `tests/local-runtime/process.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `RuntimePaths`, `RuntimeConfig`, `CommandSpec`, `CommandResult`, `resolveRuntimePaths()`, and `runCommand()`.
- `runCommand(spec: CommandSpec): Promise<CommandResult>` must redact all `secretValues` from captured output and errors.

- [ ] **Step 1: Write failing path and redaction tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveRuntimePaths } from "../../runtime/local/paths";
import { redactText } from "../../runtime/local/process";

it("keeps mutable data outside the application directory", () => {
  const paths = resolveRuntimePaths({ platform: "win32", programFiles: "C:\\Program Files", programData: "C:\\ProgramData" });
  expect(paths.appDir).toBe("C:\\Program Files\\Daymark");
  expect(paths.dataDir).toBe("C:\\ProgramData\\Daymark\\data");
  expect(paths.backupDir).toBe("C:\\ProgramData\\Daymark\\backups");
  expect(paths.logDir).toBe("C:\\ProgramData\\Daymark\\logs");
});

it("removes secrets from diagnostics", () => {
  expect(redactText("failed token-123", ["token-123"])).toBe("failed [REDACTED]");
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm run unit -- tests/local-runtime/paths.test.ts tests/local-runtime/process.test.ts`

Expected: FAIL because the runtime modules do not exist.

- [ ] **Step 3: Add the contracts and minimal implementation**

```ts
export interface RuntimePaths { appDir: string; dataDir: string; backupDir: string; logDir: string; }
export interface RuntimeConfig { host: "127.0.0.1"; port: number; paths: RuntimePaths; setupCode: string; }
export interface CommandSpec { file: string; args: string[]; cwd: string; env?: NodeJS.ProcessEnv; secretValues?: string[]; }
export interface CommandResult { exitCode: number; stdout: string; stderr: string; }
export const redactText = (value: string, secrets: string[]) => secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join("[REDACTED]"), value);
```

Implement `runCommand()` with `node:child_process.spawn`, `shell: false`, bounded capture, and rejection containing only redacted output. Extend Vitest include to `tests/**/*.test.{ts,tsx}` if needed without weakening current settings.

- [ ] **Step 4: Verify and commit**

Run: `npm run unit -- tests/local-runtime/paths.test.ts tests/local-runtime/process.test.ts`

Expected: PASS.

```text
git add runtime/local tests/local-runtime vitest.config.ts
git commit -m "feat: add local runtime foundations"
```

### Task 2: Deterministic Wrangler command construction

**Files:**
- Create: `runtime/local/wrangler.ts`
- Create: `runtime/local/wrangler.local.json`
- Create: `tests/local-runtime/wrangler.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `RuntimeConfig`, `CommandSpec`.
- Produces: `migrationCommand(config)`, `exportCommand(config, outputFile)`, and `serveCommand(config)` returning `CommandSpec`.

- [ ] **Step 1: Write the failing command test**

```ts
it("builds a loopback-only persistent serve command", () => {
  const command = serveCommand(config);
  expect(command.file).toMatch(/node(?:\.exe)?$/i);
  expect(command.args).toEqual(expect.arrayContaining([
    expect.stringMatching(/wrangler(?:\.js)?$/), "dev", "--config", expect.stringMatching(/wrangler\.local\.json$/),
    "--persist-to", config.paths.dataDir, "--ip", "127.0.0.1", "--port", "3210",
  ]));
});
```

- [ ] **Step 2: Confirm the test fails**

Run: `npm run unit -- tests/local-runtime/wrangler.test.ts`

Expected: FAIL because `serveCommand` is undefined.

- [ ] **Step 3: Implement exact commands and scripts**

`runtime/local/wrangler.local.json` must set `main` to `../../dist/server/index.js`, `compatibility_date` to `2026-05-15`, `assets.directory` to `../../dist/client`, and a local D1 database named `daymark-local` bound as `DB` with `migrations_dir` set to `../../drizzle`. Commands must invoke the repository copy of `wrangler/bin/wrangler.js` through `process.execPath`, never a global binary.

Add scripts:

```json
{
  "runtime:start": "node --import tsx runtime/local/cli.ts start",
  "runtime:migrate": "node --import tsx runtime/local/cli.ts migrate",
  "runtime:backup": "node --import tsx runtime/local/cli.ts backup"
}
```

Add pinned runtime dependencies `tsx` and `wrangler` to production dependencies so packaged installs and Docker do not need globally installed tools.

- [ ] **Step 4: Verify and commit**

Run: `npm run unit -- tests/local-runtime/wrangler.test.ts`

Expected: PASS.

```text
git add runtime/local/wrangler.ts runtime/local/wrangler.local.json tests/local-runtime/wrangler.test.ts package.json package-lock.json
git commit -m "feat: define persistent local worker commands"
```

### Task 3: Migration chain and loopback health endpoint

**Files:**
- Create: `runtime/local/migrations.ts`
- Create: `lib/runtime-health.ts`
- Create: `app/api/health/route.ts`
- Create: `tests/local-runtime/migrations.test.ts`
- Create: `tests/runtime-health.test.ts`

**Interfaces:**
- Consumes: `migrationCommand()`, `runCommand()`.
- Produces: `listCommittedMigrations(dir: string): Promise<string[]>`, `applyMigrations(config): Promise<MigrationResult>`, `readRuntimeHealth(db): Promise<RuntimeHealth>`.
- `RuntimeHealth` is `{ status: "ok" | "needs_migration"; appVersion: string; latestMigration: string | null }`.

- [ ] **Step 1: Write tests for ordered migrations and health**

```ts
expect(await listCommittedMigrations("drizzle")).toEqual([
  "0000_icy_doorman.sql",
  "0001_daymark_widget_auth.sql",
  "0002_daymark_company_workspaces.sql",
]);
expect(await readRuntimeHealth(fakeDbWithLatest("0002_daymark_company_workspaces.sql"))).toEqual({
  status: "ok", appVersion: "0.1.0", latestMigration: "0002_daymark_company_workspaces.sql",
});
```

- [ ] **Step 2: Confirm failure**

Run: `npm run unit -- tests/local-runtime/migrations.test.ts tests/runtime-health.test.ts`

Expected: FAIL because migration and health modules do not exist.

- [ ] **Step 3: Implement migration verification and route**

Read only `^\d{4}_.+\.sql$`, sort lexically, run Wrangler D1 migrations, then query `d1_migrations` for the latest applied name. The route must return JSON, `Cache-Control: no-store`, and no appointment or credential data. Return HTTP 503 with `status: "needs_migration"` when the applied migration differs from the committed final filename.

- [ ] **Step 4: Verify and commit**

Run: `npm run unit -- tests/local-runtime/migrations.test.ts tests/runtime-health.test.ts`

Expected: PASS.

```text
git add runtime/local/migrations.ts lib/runtime-health.ts app/api/health tests/local-runtime/migrations.test.ts tests/runtime-health.test.ts
git commit -m "feat: verify local migrations and health"
```

### Task 4: Verified backups and restore guardrails

**Files:**
- Create: `runtime/local/backups.ts`
- Create: `tests/local-runtime/backups.test.ts`

**Interfaces:**
- Consumes: `exportCommand()`, `runCommand()`, `RuntimeConfig`.
- Produces: `createBackup(config): Promise<BackupManifest>`, `verifyBackup(path): Promise<BackupManifest>`, `restoreBackup(config, path): Promise<void>`.
- `BackupManifest` contains `formatVersion: 1`, `createdAt`, `appVersion`, `latestMigration`, `sqlFile`, `sha256`, and `integrity: "verified"`.

- [ ] **Step 1: Write failing backup integrity tests**

```ts
it("rejects a backup whose SQL hash changed", async () => {
  const backup = await fixtureBackup();
  await appendFile(backup.sqlPath, "-- changed");
  await expect(verifyBackup(backup.manifestPath)).rejects.toThrow("Backup integrity check failed");
});
```

- [ ] **Step 2: Confirm failure**

Run: `npm run unit -- tests/local-runtime/backups.test.ts`

Expected: FAIL because backup verification does not exist.

- [ ] **Step 3: Implement atomic backup and restore**

Export to `YYYYMMDDTHHMMSSZ.sql.partial`, hash the completed SQL with SHA-256, write `YYYYMMDDTHHMMSSZ.json.partial`, verify both, then rename both into place. Restore must verify the manifest, stop before replacing any active database, create a pre-restore backup, import into a fresh persistence directory, run migrations, and swap directories only after health succeeds. Normal backups exclude setup and tunnel secrets.

- [ ] **Step 4: Verify and commit**

Run: `npm run unit -- tests/local-runtime/backups.test.ts`

Expected: PASS.

```text
git add runtime/local/backups.ts tests/local-runtime/backups.test.ts
git commit -m "feat: add verified local backups"
```

### Task 5: Stable local CLI and lifecycle integration test

**Files:**
- Create: `runtime/local/host.ts`
- Create: `runtime/local/cli.ts`
- Create: `tests/local-runtime/cli.test.ts`
- Create: `tests/local-runtime/integration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: migration, backup, restore, and serve modules.
- Produces CLI commands `start`, `migrate`, `health`, `backup`, `verify-backup`, and `restore` with JSON output and nonzero failure exit codes.

- [ ] **Step 1: Write failing CLI contract tests**

```ts
expect(parseArgs(["start", "--port", "3210"])).toEqual({ command: "start", port: 3210 });
expect(() => parseArgs(["start", "--port", "80"])).toThrow("Port must be between 1024 and 65535");
```

The integration test must build the app, migrate into a temporary directory, start on an allocated loopback port, fetch `/api/health`, and stop the child process cleanly.

- [ ] **Step 2: Confirm focused failure**

Run: `npm run unit -- tests/local-runtime/cli.test.ts`

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement the CLI and lifecycle**

Use structured JSON on stdout, diagnostics on stderr, SIGINT/SIGTERM shutdown, a 30-second startup timeout, and no shell interpolation. `start` applies migrations before spawning the server and exits if `/api/health` does not reach `status: "ok"`.

- [ ] **Step 4: Verify unit and integration behaviour**

Run: `npm run unit -- tests/local-runtime/cli.test.ts`

Run: `npm run build && node --test tests/local-runtime/integration.test.mjs`

Expected: both PASS; the integration child exits cleanly.

- [ ] **Step 5: Commit**

```text
git add runtime/local/host.ts runtime/local/cli.ts tests/local-runtime package.json package-lock.json
git commit -m "feat: add Daymark local service CLI"
```

### Task 6: Docker image and Compose persistence

**Files:**
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.dockerignore`
- Create: `tests/docker-compose.test.mjs`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: `runtime/local/cli.ts` and built `dist` output.
- Produces: `daymark` container listening on container port `3210`, named volume `daymark-data`, and health check `/api/health`.

- [ ] **Step 1: Write the failing Compose structure test**

```js
assert.match(compose, /daymark-data:\s*$/m);
assert.match(compose, /127\.0\.0\.1:\$\{DAYMARK_PORT:-3210\}:3210/);
assert.match(compose, /\/api\/health/);
assert.doesNotMatch(compose, /DAYMARK_SETUP_CODE:\s*[^$\s]/);
```

- [ ] **Step 2: Confirm failure**

Run: `node --test tests/docker-compose.test.mjs`

Expected: FAIL because the container files do not exist.

- [ ] **Step 3: Implement the multi-stage image and Compose service**

The build stage runs `npm ci`, tests needed for build confidence, and `npm run build`. The runtime stage includes production dependencies, `dist`, `drizzle`, and `runtime/local`; runs as a non-root user; mounts `/var/lib/daymark`; and starts `node --import tsx runtime/local/cli.ts start --data-dir /var/lib/daymark --port 3210`. Compose binds only to `127.0.0.1`, loads secrets from `.env.local`, uses `restart: unless-stopped`, and never deletes its named volume on ordinary stop.

- [ ] **Step 4: Verify container persistence**

Run: `node --test tests/docker-compose.test.mjs`

Run: `docker compose config`

Run: `docker compose up -d --build && docker compose ps --format json`

Expected: structure test PASS, config valid, service healthy. Create a test company, restart the service, and confirm it remains present; then run `docker compose down` without `--volumes`.

- [ ] **Step 5: Run the complete project gate and commit**

Run: `npm run unit && npm run lint && npm run test`

Expected: all existing and new checks PASS.

```text
git add Dockerfile compose.yaml .dockerignore .env.example package.json package-lock.json tests/docker-compose.test.mjs
git commit -m "feat: add persistent Docker installation"
```
