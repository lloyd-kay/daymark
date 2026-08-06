import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import type { RuntimeConfig } from "./contracts";
import { createBackup, restoreBackup, verifyBackup } from "./backups";
import { startRuntime, waitForHealth } from "./host";
import { applyMigrations } from "./migrations";

const COMMANDS = ["start", "migrate", "health", "backup", "verify-backup", "restore"] as const;
type RuntimeCommand = typeof COMMANDS[number];

export interface ParsedArgs {
  command: RuntimeCommand;
  host?: "127.0.0.1" | "0.0.0.0";
  port?: number;
  appDir?: string;
  dataDir?: string;
  backupDir?: string;
  logDir?: string;
  manifest?: string;
}

const VALUE_OPTIONS = new Set(["--host", "--port", "--app-dir", "--data-dir", "--backup-dir", "--log-dir", "--manifest"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] as RuntimeCommand | undefined;
  if (!command || !COMMANDS.includes(command)) {
    throw new Error(`Expected a command: ${COMMANDS.join(", ")}`);
  }

  const parsed: ParsedArgs = { command };
  for (let index = 1; index < argv.length; index += 2) {
    const option = argv[index];
    if (!VALUE_OPTIONS.has(option)) throw new Error(`Unknown option: ${option}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${option} requires a value`);

    if (option === "--host") {
      if (value !== "127.0.0.1" && value !== "0.0.0.0") {
        throw new Error("Host must be 127.0.0.1 or 0.0.0.0");
      }
      parsed.host = value;
    } else if (option === "--port") {
      const port = Number(value);
      if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
        throw new Error("Port must be between 1024 and 65535");
      }
      parsed.port = port;
    } else if (option === "--app-dir") parsed.appDir = value;
    else if (option === "--data-dir") parsed.dataDir = value;
    else if (option === "--backup-dir") parsed.backupDir = value;
    else if (option === "--log-dir") parsed.logDir = value;
    else if (option === "--manifest") parsed.manifest = value;
  }

  if ((command === "verify-backup" || command === "restore") && !parsed.manifest) {
    throw new Error(`--manifest is required for ${command}`);
  }
  return parsed;
}

export function resolveConfig(parsed: ParsedArgs, env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const setupCode = env.DAYMARK_SETUP_CODE;
  if (!setupCode) throw new Error("DAYMARK_SETUP_CODE is required in the protected process environment");
  const appDir = resolveRuntimePath(parsed.appDir ?? env.DAYMARK_APP_DIR ?? process.cwd());
  const stateRoot = resolveRuntimePath(env.DAYMARK_STATE_DIR ?? path.join(appDir, ".daymark"));

  return {
    host: parsed.host ?? "127.0.0.1",
    port: parsed.port ?? Number(env.DAYMARK_PORT ?? 3210),
    setupCode,
    paths: {
      appDir,
      dataDir: resolveRuntimePath(parsed.dataDir ?? env.DAYMARK_DATA_DIR ?? path.join(stateRoot, "data")),
      backupDir: resolveRuntimePath(parsed.backupDir ?? env.DAYMARK_BACKUP_DIR ?? path.join(stateRoot, "backups")),
      logDir: resolveRuntimePath(parsed.logDir ?? env.DAYMARK_LOG_DIR ?? path.join(stateRoot, "logs")),
    },
  };
}

function resolveRuntimePath(value: string): string {
  return path.win32.isAbsolute(value) || path.posix.isAbsolute(value) ? value : path.resolve(value);
}

async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  if (parsed.command === "verify-backup") {
    writeJson(await verifyBackup(path.resolve(parsed.manifest!)));
    return;
  }

  const config = resolveConfig(parsed);
  await Promise.all([
    mkdir(config.paths.dataDir, { recursive: true }),
    mkdir(config.paths.backupDir, { recursive: true }),
    mkdir(config.paths.logDir, { recursive: true }),
  ]);

  if (parsed.command === "migrate") {
    writeJson({ status: "migrated", ...await applyMigrations(config) });
    return;
  }
  if (parsed.command === "health") {
    writeJson(await waitForHealth(`http://${config.host}:${config.port}/api/health`, { timeoutMs: 3_000 }));
    return;
  }
  if (parsed.command === "backup") {
    writeJson({ status: "backed_up", ...await createBackup(config) });
    return;
  }
  if (parsed.command === "restore") {
    writeJson({ status: "restored", ...await restoreBackup(config, path.resolve(parsed.manifest!)) });
    return;
  }

  await applyMigrations(config);
  const runtime = await startRuntime(config);
  const localHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  writeJson({ status: "running", url: `http://${localHost}:${config.port}`, health: runtime.health });

  const stop = () => void runtime.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const input = createInterface({ input: process.stdin, terminal: false });
  input.on("line", (line) => {
    if (line.trim().toLowerCase() === "stop") stop();
  });
  const exitCode = await runtime.exited;
  input.close();
  process.exitCode = exitCode ?? 0;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown local runtime failure";
    process.stderr.write(`${JSON.stringify({ status: "error", message })}\n`);
    process.exitCode = 1;
  }
}
