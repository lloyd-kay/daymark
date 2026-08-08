import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Miniflare } from "miniflare";

import type { RuntimeConfig } from "./contracts";
import { LOCAL_DATABASE_ID } from "./wrangler";

export async function exportLocalDatabase(
  config: RuntimeConfig,
  outputFile: string,
): Promise<void> {
  const runtime = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Persist: path.join(config.paths.dataDir, "v3", "d1"),
    d1Databases: { DB: LOCAL_DATABASE_ID },
  });

  try {
    const database = await runtime.getD1Database("DB");
    const rows = await database
      .prepare("PRAGMA miniflare_d1_export(?,?,?);")
      .bind(false, false)
      .raw();
    const statements = rows[0];
    if (!Array.isArray(statements) || !statements.every((value) => typeof value === "string")) {
      throw new Error("Daymark could not export the local database");
    }
    await writeFile(outputFile, `${statements.join("\n")}\n`, { encoding: "utf8", flag: "wx" });
  } finally {
    await runtime.dispose();
  }
}
