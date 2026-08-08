import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { CommandResult, CommandSpec, RuntimeConfig } from "../../runtime/local/contracts";
import { createBackup, restoreBackup, verifyBackup } from "../../runtime/local/backups";

describe("verified local backups", () => {
  it("publishes an SQL export only with a verified manifest", async () => {
    const fixture = await createFixture();
    const manifest = await createBackup(fixture.config, fixture.dependencies);
    const files = await readdir(fixture.config.paths.backupDir);

    expect(manifest).toMatchObject({
      formatVersion: 1,
      appVersion: "0.1.0",
      latestMigration: "0002_daymark_company_workspaces.sql",
      integrity: "verified",
    });
    expect(files).toContain(manifest.sqlFile);
    expect(files).toContain(path.basename(manifest.manifestFile));
    expect(files.some((file) => file.endsWith(".partial"))).toBe(false);
    await expect(verifyBackup(manifest.manifestFile)).resolves.toEqual(manifest);
  });

  it("rejects a backup whose SQL hash changed", async () => {
    const fixture = await createFixture();
    const backup = await createBackup(fixture.config, fixture.dependencies);
    await appendFile(path.join(fixture.config.paths.backupDir, backup.sqlFile), "-- changed");

    await expect(verifyBackup(backup.manifestFile)).rejects.toThrow("Backup integrity check failed");
  });

  it("restores through a staged directory while preserving rollback data and a safety backup", async () => {
    const fixture = await createFixture();
    const source = await createBackup(fixture.config, fixture.dependencies);
    await mkdir(fixture.config.paths.dataDir, { recursive: true });
    await writeFile(path.join(fixture.config.paths.dataDir, "existing.marker"), "existing data");

    const result = await restoreBackup(fixture.config, source.manifestFile, fixture.dependencies);
    const siblings = await readdir(path.dirname(fixture.config.paths.dataDir));

    expect(result.restoredFrom).toBe(source.manifestFile);
    expect(result.safetyBackup.integrity).toBe("verified");
    expect(result.rollbackDir).toMatch(/\.rollback-20260806T123456000Z-fixedid$/);
    expect(siblings.some((entry) => entry.includes(".restore-"))).toBe(false);
    await expect(readFile(path.join(result.rollbackDir!, "existing.marker"), "utf8")).resolves.toBe("existing data");
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "daymark-backup-test-"));
  const config: RuntimeConfig = {
    host: "127.0.0.1",
    port: 3210,
    setupCode: "SETUP-SECRET",
    paths: {
      appDir: process.cwd(),
      dataDir: path.join(root, "data"),
      backupDir: path.join(root, "backups"),
      logDir: path.join(root, "logs"),
    },
  };

  const run = async (command: CommandSpec): Promise<CommandResult> => {
    if (command.args.includes("--json")) {
      return {
        exitCode: 0,
        stdout: JSON.stringify([
          { results: [{ integrity_check: "ok" }, { name: "0002_daymark_company_workspaces.sql" }], success: true },
        ]),
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "ok", stderr: "" };
  };

  return {
    config,
    dependencies: {
      run,
      now: () => new Date("2026-08-06T12:34:56.000Z"),
      id: () => "fixedid",
      assertStopped: async () => undefined,
      exportDatabase: async (_config: RuntimeConfig, outputFile: string) => {
        await mkdir(path.dirname(outputFile), { recursive: true });
        await writeFile(outputFile, "CREATE TABLE example (id text);\n");
      },
    },
  };
}
