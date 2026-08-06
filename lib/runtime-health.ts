import migrationJournal from "../drizzle/meta/_journal.json";
import packageJson from "../package.json";

interface MigrationRow {
  name: string;
}

interface HealthStatement {
  first<T>(): Promise<T | null>;
}

export interface HealthDatabase {
  prepare(sql: string): HealthStatement;
}

export interface RuntimeHealth {
  status: "ok" | "needs_migration";
  appVersion: string;
  latestMigration: string | null;
}

const latestJournalEntry = migrationJournal.entries.at(-1);

export const EXPECTED_LATEST_MIGRATION = latestJournalEntry ? `${latestJournalEntry.tag}.sql` : null;
export const DAYMARK_VERSION = packageJson.version;

export async function readRuntimeHealth(database: HealthDatabase): Promise<RuntimeHealth> {
  const row = await database
    .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
    .first<MigrationRow>();
  const latestMigration = row?.name ?? null;

  return {
    status: latestMigration !== null && latestMigration === EXPECTED_LATEST_MIGRATION ? "ok" : "needs_migration",
    appVersion: DAYMARK_VERSION,
    latestMigration,
  };
}
