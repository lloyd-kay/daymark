import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CommandSpec, RuntimeConfig } from "./contracts";

function pathApiFor(root: string): typeof path.win32 | typeof path.posix {
  return /^[A-Za-z]:[\\/]/.test(root) ? path.win32 : path.posix;
}

function runtimeEnvironment(config: RuntimeConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DAYMARK_SETUP_CODE: config.setupCode,
    WRANGLER_LOG_PATH: pathApiFor(config.paths.logDir).join(config.paths.logDir, "wrangler.log"),
  };
}

function baseCommand(config: RuntimeConfig): Pick<CommandSpec, "file" | "cwd" | "env" | "secretValues"> & {
  wranglerCli: string;
  configFile: string;
} {
  const pathApi = pathApiFor(config.paths.appDir);
  return {
    file: process.execPath,
    cwd: config.paths.appDir,
    env: runtimeEnvironment(config),
    secretValues: [config.setupCode],
    wranglerCli: pathApi.join(config.paths.appDir, "node_modules", "wrangler", "bin", "wrangler.js"),
    configFile: pathApi.join(config.paths.dataDir, "wrangler.local.json"),
  };
}

export async function writeRuntimeConfig(config: RuntimeConfig): Promise<string> {
  const pathApi = pathApiFor(config.paths.appDir);
  const configFile = pathApiFor(config.paths.dataDir).join(config.paths.dataDir, "wrangler.local.json");
  const contents = {
    name: "daymark-local",
    main: pathApi.join(config.paths.appDir, "dist", "server", "index.js"),
    compatibility_date: "2026-05-15",
    compatibility_flags: ["nodejs_compat"],
    assets: {
      directory: pathApi.join(config.paths.appDir, "dist", "client"),
    },
    secrets: {
      required: ["DAYMARK_SETUP_CODE"],
    },
    d1_databases: [{
      binding: "DB",
      database_name: "daymark-local",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: pathApi.join(config.paths.appDir, "drizzle"),
    }],
  };

  await mkdir(config.paths.dataDir, { recursive: true });
  await writeFile(configFile, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  return configFile;
}

function command(config: RuntimeConfig, args: string[]): CommandSpec {
  const base = baseCommand(config);
  return {
    file: base.file,
    args: [base.wranglerCli, ...args],
    cwd: base.cwd,
    env: base.env,
    secretValues: base.secretValues,
  };
}

export function serveCommand(config: RuntimeConfig): CommandSpec {
  const base = baseCommand(config);
  return command(config, [
    "dev",
    "--config",
    base.configFile,
    "--persist-to",
    config.paths.dataDir,
    "--ip",
    config.host,
    "--port",
    String(config.port),
  ]);
}

export function migrationCommand(config: RuntimeConfig): CommandSpec {
  const base = baseCommand(config);
  return command(config, [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    base.configFile,
    "--persist-to",
    config.paths.dataDir,
  ]);
}

export function exportCommand(config: RuntimeConfig, outputFile: string): CommandSpec {
  const base = baseCommand(config);
  return command(config, [
    "d1",
    "export",
    "DB",
    "--local",
    "--output",
    outputFile,
    "--config",
    base.configFile,
    "--persist-to",
    config.paths.dataDir,
  ]);
}

export function importCommand(config: RuntimeConfig, inputFile: string): CommandSpec {
  const base = baseCommand(config);
  return command(config, [
    "d1",
    "execute",
    "DB",
    "--local",
    "--file",
    inputFile,
    "--config",
    base.configFile,
    "--persist-to",
    config.paths.dataDir,
  ]);
}

export function integrityCommand(config: RuntimeConfig): CommandSpec {
  const base = baseCommand(config);
  return command(config, [
    "d1",
    "execute",
    "DB",
    "--local",
    "--json",
    "--command",
    "PRAGMA integrity_check; SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1;",
    "--config",
    base.configFile,
    "--persist-to",
    config.paths.dataDir,
  ]);
}
