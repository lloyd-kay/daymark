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
    configFile: pathApi.join(config.paths.appDir, "runtime", "local", "wrangler.local.json"),
  };
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
