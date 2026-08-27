import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";

describe("service-scoped Embed preference migration", () => {
  it("preserves catalogue defaults and enforces same-workspace service mappings", async () => {
    const runtime = new Miniflare({
      modules: true,
      script: "export default {}",
      d1Databases: { DB: "00000000-0000-4000-8000-000000000000" },
    });

    try {
      const database = await runtime.getD1Database("DB");
      await runStatements(database, [
        "PRAGMA foreign_keys = ON",
        `CREATE TABLE workspaces (
          id text PRIMARY KEY NOT NULL,
          name text NOT NULL,
          slug text NOT NULL,
          active integer DEFAULT true NOT NULL
        )`,
        `CREATE TABLE services (
          id text PRIMARY KEY NOT NULL,
          workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          slug text NOT NULL,
          active integer DEFAULT true NOT NULL
        )`,
        `CREATE TABLE workspace_embed_preferences (
          workspace_id text PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          default_mode text NOT NULL CHECK(default_mode IN ('floating', 'inline')),
          default_service_scope text NOT NULL CHECK(default_service_scope IN ('all')),
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`,
        `INSERT INTO workspaces (id, name, slug, active) VALUES
          ('workspace-a', 'Workspace A', 'workspace-a', true),
          ('workspace-b', 'Workspace B', 'workspace-b', true)`,
        `INSERT INTO services (id, workspace_id, slug, active) VALUES
          ('service-a', 'workspace-a', 'camera-installation', true),
          ('service-b', 'workspace-b', 'alarm-installation', true)`,
        `INSERT INTO workspace_embed_preferences
          (workspace_id, default_mode, default_service_scope)
        VALUES
          ('workspace-a', 'inline', 'all'),
          ('workspace-b', 'floating', 'all')`,
      ]);

      const migration = await readFile(
        new URL("../drizzle/0006_service_scope_widget_defaults.sql", import.meta.url),
        "utf8",
      );
      await runStatements(database, migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean));

      await expect(readPreference(database, "workspace-a")).resolves.toEqual({
        workspaceId: "workspace-a",
        defaultMode: "inline",
        defaultServiceScope: "all",
        defaultServiceId: null,
      });

      await expect(database.prepare(`
        UPDATE workspace_embed_preferences
        SET default_service_scope = 'all', default_service_id = 'service-a'
        WHERE workspace_id = 'workspace-a'
      `).run()).rejects.toThrow();
      await expect(database.prepare(`
        UPDATE workspace_embed_preferences
        SET default_service_scope = 'service', default_service_id = NULL
        WHERE workspace_id = 'workspace-a'
      `).run()).rejects.toThrow();
      await expect(database.prepare(`
        UPDATE workspace_embed_preferences
        SET default_service_scope = 'service', default_service_id = 'service-b'
        WHERE workspace_id = 'workspace-a'
      `).run()).rejects.toThrow();

      await database.prepare(`
        UPDATE workspace_embed_preferences
        SET default_service_scope = 'service', default_service_id = 'service-a'
        WHERE workspace_id = 'workspace-a'
      `).run();
      await expect(readPreference(database, "workspace-a")).resolves.toMatchObject({
        defaultMode: "inline",
        defaultServiceScope: "service",
        defaultServiceId: "service-a",
      });
      await expect(database.prepare("PRAGMA foreign_key_check").all())
        .resolves.toEqual(expect.objectContaining({ results: [] }));
    } finally {
      await runtime.dispose();
    }
  });
});

async function runStatements(
  database: Awaited<ReturnType<Miniflare["getD1Database"]>>,
  statements: string[],
) {
  for (const statement of statements) {
    await database.prepare(statement).run();
  }
}

async function readPreference(
  database: Awaited<ReturnType<Miniflare["getD1Database"]>>,
  workspaceId: string,
) {
  return database.prepare(`
    SELECT workspace_id AS workspaceId,
           default_mode AS defaultMode,
           default_service_scope AS defaultServiceScope,
           default_service_id AS defaultServiceId
    FROM workspace_embed_preferences
    WHERE workspace_id = ?
  `).bind(workspaceId).first();
}
