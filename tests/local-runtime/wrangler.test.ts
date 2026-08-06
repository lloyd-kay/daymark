import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { RuntimeConfig } from "../../runtime/local/contracts";
import { exportCommand, importCommand, integrityCommand, migrationCommand, serveCommand, writeRuntimeConfig } from "../../runtime/local/wrangler";

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
      path.win32.join(config.paths.dataDir, "wrangler.local.json"),
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

  it("uses an explicitly selected container bind address", () => {
    const command = serveCommand({ ...config, host: "0.0.0.0" });
    const ipIndex = command.args.indexOf("--ip");
    expect(command.args[ipIndex + 1]).toBe("0.0.0.0");
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

  it("constructs restore and integrity commands against the selected persistence directory", () => {
    const imported = importCommand(config, "C:\\Daymark\\restore.sql");
    const integrity = integrityCommand(config);

    expect(imported.args).toEqual(expect.arrayContaining([
      "d1", "execute", "DB", "--local", "--file", "C:\\Daymark\\restore.sql",
      "--persist-to", config.paths.dataDir,
    ]));
    expect(integrity.args).toEqual(expect.arrayContaining([
      "d1", "execute", "DB", "--local", "--json", "--command",
      "PRAGMA integrity_check; SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1;",
    ]));
  });

  it("writes runtime-generated Wrangler state beside mutable data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "daymark-wrangler-config-"));
    const localConfig: RuntimeConfig = {
      ...config,
      paths: {
        ...config.paths,
        appDir: path.join(root, "app"),
        dataDir: path.join(root, "state", "data"),
      },
    };

    const configFile = await writeRuntimeConfig(localConfig);
    const written = JSON.parse(await readFile(configFile, "utf8"));

    expect(configFile).toBe(path.join(localConfig.paths.dataDir, "wrangler.local.json"));
    expect(written.main).toBe(path.join(localConfig.paths.appDir, "dist", "server", "index.js"));
    expect(written.assets.directory).toBe(path.join(localConfig.paths.appDir, "dist", "client"));
    expect(written.d1_databases[0].migrations_dir).toBe(path.join(localConfig.paths.appDir, "drizzle"));
  });
});
