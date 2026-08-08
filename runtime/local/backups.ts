import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import { DAYMARK_VERSION, EXPECTED_LATEST_MIGRATION } from "../../lib/runtime-health";
import type { CommandResult, CommandSpec, RuntimeConfig } from "./contracts";
import { exportLocalDatabase } from "./database-export";
import { migrationCommand, importCommand, integrityCommand, writeRuntimeConfig } from "./wrangler";
import { runCommand } from "./process";

interface StoredBackupManifest {
  formatVersion: 1;
  createdAt: string;
  appVersion: string;
  latestMigration: string;
  sqlFile: string;
  sha256: string;
  integrity: "verified";
}

export interface BackupManifest extends StoredBackupManifest {
  manifestFile: string;
}

export interface RestoreResult {
  restoredFrom: string;
  safetyBackup: BackupManifest;
  rollbackDir: string | null;
}

export interface BackupDependencies {
  run?: (command: CommandSpec) => Promise<CommandResult>;
  now?: () => Date;
  id?: () => string;
  assertStopped?: (config: RuntimeConfig) => Promise<void>;
  exportDatabase?: (config: RuntimeConfig, outputFile: string) => Promise<void>;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, "");
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function availableBaseName(directory: string, initial: string): Promise<string> {
  let candidate = initial;
  let suffix = 2;
  while (await exists(path.join(directory, `${candidate}.json`)) || await exists(path.join(directory, `${candidate}.sql`))) {
    candidate = `${initial}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function validateStoredManifest(value: unknown): asserts value is StoredBackupManifest {
  if (!value || typeof value !== "object") throw new Error("Backup manifest is invalid");
  const manifest = value as Partial<StoredBackupManifest>;
  if (
    manifest.formatVersion !== 1
    || manifest.integrity !== "verified"
    || typeof manifest.createdAt !== "string"
    || Number.isNaN(Date.parse(manifest.createdAt))
    || typeof manifest.appVersion !== "string"
    || typeof manifest.latestMigration !== "string"
    || typeof manifest.sqlFile !== "string"
    || path.basename(manifest.sqlFile) !== manifest.sqlFile
    || typeof manifest.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
  ) {
    throw new Error("Backup manifest is invalid");
  }
}

export async function createBackup(
  config: RuntimeConfig,
  dependencies: BackupDependencies = {},
): Promise<BackupManifest> {
  if (!EXPECTED_LATEST_MIGRATION) throw new Error("Daymark has no committed migration to record");
  const now = dependencies.now?.() ?? new Date();
  const id = dependencies.id?.() ?? randomUUID().slice(0, 8);
  await mkdir(config.paths.backupDir, { recursive: true });

  const base = await availableBaseName(config.paths.backupDir, `daymark-${timestamp(now)}-${id}`);
  const sqlFile = `${base}.sql`;
  const manifestName = `${base}.json`;
  const sqlPath = path.join(config.paths.backupDir, sqlFile);
  const sqlPartial = `${sqlPath}.partial`;
  const manifestPath = path.join(config.paths.backupDir, manifestName);
  const manifestPartial = `${manifestPath}.partial`;

  await writeRuntimeConfig(config);
  await (dependencies.exportDatabase ?? exportLocalDatabase)(config, sqlPartial);
  const sql = await readFile(sqlPartial);
  if (sql.byteLength === 0) throw new Error("Backup export was empty");
  await rename(sqlPartial, sqlPath);

  const stored: StoredBackupManifest = {
    formatVersion: 1,
    createdAt: now.toISOString(),
    appVersion: DAYMARK_VERSION,
    latestMigration: EXPECTED_LATEST_MIGRATION,
    sqlFile,
    sha256: sha256(sql),
    integrity: "verified",
  };
  await writeFile(manifestPartial, `${JSON.stringify(stored, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await verifyBackup(manifestPartial);
  await rename(manifestPartial, manifestPath);

  return { ...stored, manifestFile: manifestPath };
}

export async function verifyBackup(manifestFile: string): Promise<BackupManifest> {
  let stored: unknown;
  try {
    stored = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {
    throw new Error("Backup manifest is invalid");
  }
  validateStoredManifest(stored);

  const sqlPath = path.join(path.dirname(manifestFile), stored.sqlFile);
  const actual = sha256(await readFile(sqlPath));
  if (actual !== stored.sha256) throw new Error("Backup integrity check failed");

  return { ...stored, manifestFile };
}

export async function restoreBackup(
  config: RuntimeConfig,
  manifestFile: string,
  dependencies: BackupDependencies = {},
): Promise<RestoreResult> {
  const source = await verifyBackup(manifestFile);
  await (dependencies.assertStopped ?? assertRuntimeStopped)(config);
  const safetyBackup = await createBackup(config, dependencies);
  const run = dependencies.run ?? runCommand;
  const now = dependencies.now?.() ?? new Date();
  const id = dependencies.id?.() ?? randomUUID().slice(0, 8);
  const stagedDataDir = `${config.paths.dataDir}.restore-${id}`;
  const rollbackDir = `${config.paths.dataDir}.rollback-${timestamp(now)}-${id}`;
  const stagedConfig: RuntimeConfig = {
    ...config,
    paths: { ...config.paths, dataDir: stagedDataDir },
  };

  await mkdir(stagedDataDir, { recursive: false });
  await writeRuntimeConfig(stagedConfig);
  const sqlPath = path.join(path.dirname(manifestFile), source.sqlFile);
  await run(importCommand(stagedConfig, sqlPath));
  await run(migrationCommand(stagedConfig));
  const integrity = await run(integrityCommand(stagedConfig));
  if (!integrity.stdout.includes('"integrity_check":"ok"') || !integrity.stdout.includes(source.latestMigration)) {
    throw new Error("Restored database verification failed");
  }

  const hadCurrentData = await exists(config.paths.dataDir);
  if (hadCurrentData) await rename(config.paths.dataDir, rollbackDir);
  try {
    await rename(stagedDataDir, config.paths.dataDir);
  } catch (error) {
    if (hadCurrentData && await exists(rollbackDir)) await rename(rollbackDir, config.paths.dataDir);
    throw error;
  }

  return {
    restoredFrom: manifestFile,
    safetyBackup,
    rollbackDir: hadCurrentData ? rollbackDir : null,
  };
}

async function assertRuntimeStopped(config: RuntimeConfig): Promise<void> {
  const portOpen = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: config.host, port: config.port });
    socket.setTimeout(1_000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

  if (portOpen) throw new Error("Stop Daymark before restoring a backup");
}
