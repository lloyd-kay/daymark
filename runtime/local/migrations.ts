import { readdir } from "node:fs/promises";

import type { CommandResult, CommandSpec, RuntimeConfig } from "./contracts";
import { runCommand } from "./process";
import { migrationCommand } from "./wrangler";

export interface MigrationResult {
  appliedCount: number;
  latestMigration: string;
}

interface MigrationDependencies {
  migrationsDir?: string;
  run?: (command: CommandSpec) => Promise<CommandResult>;
}

const MIGRATION_FILE = /^\d{4}_.+\.sql$/;

export async function listCommittedMigrations(directory: string): Promise<string[]> {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && MIGRATION_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

export async function applyMigrations(
  config: RuntimeConfig,
  dependencies: MigrationDependencies = {},
): Promise<MigrationResult> {
  const migrationsDir = dependencies.migrationsDir ?? `${config.paths.appDir}/drizzle`;
  const migrations = await listCommittedMigrations(migrationsDir);
  if (migrations.length === 0) {
    throw new Error(`No committed Daymark migrations were found in ${migrationsDir}`);
  }

  await (dependencies.run ?? runCommand)(migrationCommand(config));

  return {
    appliedCount: migrations.length,
    latestMigration: migrations.at(-1)!,
  };
}
