import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { CommandResult, RuntimeConfig } from "../../runtime/local/contracts";
import { applyMigrations, listCommittedMigrations } from "../../runtime/local/migrations";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

describe("local migrations", () => {
  it("lists only committed SQL migrations in filename order", async () => {
    await expect(listCommittedMigrations(path.join(repositoryRoot, "drizzle"))).resolves.toEqual([
      "0000_icy_doorman.sql",
      "0001_daymark_widget_auth.sql",
      "0002_daymark_company_workspaces.sql",
      "0003_daymark_seed_recovery.sql",
    ]);
  });

  it("reports the final migration after a successful apply", async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), "daymark-migration-test-"));
    const calls: string[][] = [];
    try {
      const result = await applyMigrations(runtimeConfig(stateRoot), {
        migrationsDir: path.join(repositoryRoot, "drizzle"),
        run: async (command): Promise<CommandResult> => {
          calls.push(command.args);
          return { exitCode: 0, stdout: "Migrations applied", stderr: "" };
        },
      });

      expect(result).toEqual({
        appliedCount: 4,
        latestMigration: "0003_daymark_seed_recovery.sql",
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(expect.arrayContaining(["d1", "migrations", "apply", "DB", "--local"]));
    } finally {
      await rm(stateRoot, { recursive: true, force: true });
    }
  });
});

function runtimeConfig(stateRoot: string): RuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 3210,
    setupCode: "SETUP-SECRET",
    paths: {
      appDir: repositoryRoot,
      dataDir: path.join(stateRoot, "data"),
      backupDir: path.join(stateRoot, "backups"),
      logDir: path.join(stateRoot, "logs"),
    },
  };
}
