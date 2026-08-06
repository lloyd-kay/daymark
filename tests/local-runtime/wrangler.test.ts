import path from "node:path";
import { describe, expect, it } from "vitest";

import type { RuntimeConfig } from "../../runtime/local/contracts";
import { exportCommand, migrationCommand, serveCommand } from "../../runtime/local/wrangler";

const config: RuntimeConfig = {
  host: "127.0.0.1",
  port: 3210,
  setupCode: "SETUP-SECRET",
  paths: {
    appDir: "C:\\Daymark",
    dataDir: "C:\\ProgramData\\Daymark\\data",
    backupDir: "C:\\ProgramData\\Daymark\\backups",
    logDir: "C:\\ProgramData\\Daymark\\logs",
  },
};

describe("Wrangler command construction", () => {
  it("builds a loopback-only persistent serve command", () => {
    const command = serveCommand(config);

    expect(command.file).toBe(process.execPath);
    expect(command.cwd).toBe(config.paths.appDir);
    expect(command.args).toEqual([
      path.win32.join(config.paths.appDir, "node_modules", "wrangler", "bin", "wrangler.js"),
      "dev",
      "--config",
      path.win32.join(config.paths.appDir, "runtime", "local", "wrangler.local.json"),
      "--persist-to",
      config.paths.dataDir,
      "--ip",
      "127.0.0.1",
      "--port",
      "3210",
    ]);
    expect(command.env?.DAYMARK_SETUP_CODE).toBe("SETUP-SECRET");
    expect(command.secretValues).toEqual(["SETUP-SECRET"]);
  });

  it("constructs local migration and export commands without placing secrets in arguments", () => {
    const migration = migrationCommand(config);
    const exported = exportCommand(config, "C:\\ProgramData\\Daymark\\backups\\backup.sql.partial");

    expect(migration.args).toEqual(expect.arrayContaining(["d1", "migrations", "apply", "DB", "--local"]));
    expect(exported.args).toEqual(expect.arrayContaining([
      "d1", "export", "DB", "--local", "--output", "C:\\ProgramData\\Daymark\\backups\\backup.sql.partial",
    ]));
    expect(migration.args.join(" ")).not.toContain("SETUP-SECRET");
    expect(exported.args.join(" ")).not.toContain("SETUP-SECRET");
  });
});
