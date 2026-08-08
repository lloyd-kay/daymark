import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Miniflare } from "miniflare";

import { COMMITTED_MIGRATIONS } from "../../lib/runtime-health";
import type { RuntimeConfig } from "./contracts";
import { LOCAL_DATABASE_ID } from "./wrangler";

export async function exportLocalDatabase(
  config: RuntimeConfig,
  outputFile: string,
): Promise<string> {
  const runtime = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Persist: path.join(config.paths.dataDir, "v3", "d1"),
    d1Databases: { DB: LOCAL_DATABASE_ID },
  });

  try {
    const database = await runtime.getD1Database("DB");
    let installedMigration: string | null = null;
    try {
      const latestMigration = await database
        .prepare("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1")
        .first<{ name: string }>();
      const schema = await database.prepare(`
        SELECT COUNT(*) AS count
        FROM sqlite_schema
        WHERE type = 'table'
          AND name IN ('employee_profiles', 'appointments', 'availability_rules')
      `).first<{ count: number }>();
      if (
        !latestMigration?.name
        || !COMMITTED_MIGRATIONS.includes(latestMigration.name)
        || Number(schema?.count ?? 0) !== 3
      ) {
        throw new Error("invalid Daymark schema");
      }
      installedMigration = latestMigration.name;
    } catch {
      throw new Error("Backup requires an existing migrated Daymark database");
    }
    const rows = await database
      .prepare("PRAGMA miniflare_d1_export(?,?,?);")
      .bind(false, false)
      .raw();
    const statements = rows[0];
    if (!Array.isArray(statements) || !statements.every((value) => typeof value === "string")) {
      throw new Error("Daymark could not export the local database");
    }
    await writeFile(outputFile, `${statements.join("\n")}\n`, { encoding: "utf8", flag: "wx" });
    return installedMigration!;
  } finally {
    await runtime.dispose();
  }
}
