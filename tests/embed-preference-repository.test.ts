import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cloudflare = vi.hoisted(() => ({ env: { DB: null as unknown } }));
vi.mock("cloudflare:workers", () => ({ env: cloudflare.env }));

import {
  getWorkspaceEmbedPreference,
  setWorkspaceEmbedPreference,
} from "../lib/data/embed-preference-repository";

let runtime: Miniflare;
let database: Awaited<ReturnType<Miniflare["getD1Database"]>>;

beforeAll(async () => {
  runtime = new Miniflare({
    modules: true,
    script: "export default {}",
    d1Databases: { DB: "00000000-0000-4000-8000-000000000000" },
  });
  database = await runtime.getD1Database("DB");
  cloudflare.env.DB = database;
  await runStatements(
    "PRAGMA foreign_keys = ON",
    `CREATE TABLE workspaces (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      active integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE accounts (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      display_name text NOT NULL,
      active integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE memberships (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      role text NOT NULL CHECK(role IN ('admin', 'employee')),
      active integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE workspace_embed_preferences (
      workspace_id text PRIMARY KEY NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      default_mode text NOT NULL CHECK(default_mode IN ('floating', 'inline')),
      default_service_scope text NOT NULL CHECK(default_service_scope IN ('all')),
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
  );
});

afterAll(async () => {
  cloudflare.env.DB = null;
  await runtime.dispose();
});

beforeEach(async () => {
  await runStatements(
    "DELETE FROM workspace_embed_preferences",
    "DELETE FROM memberships",
    "DELETE FROM accounts",
    "DELETE FROM workspaces",
    `INSERT INTO workspaces (id, name, slug, active) VALUES
      ('workspace-a', 'Workspace A', 'workspace-a', true),
      ('workspace-b', 'Workspace B', 'workspace-b', true)`,
    `INSERT INTO accounts (id, email, display_name, active) VALUES
      ('account-admin', 'admin@example.test', 'Administrator', true),
      ('account-employee', 'employee@example.test', 'Employee', true),
      ('account-inactive', 'inactive@example.test', 'Inactive Admin', true)`,
    `INSERT INTO memberships (id, workspace_id, account_id, role, active) VALUES
      ('membership-admin-a', 'workspace-a', 'account-admin', 'admin', true),
      ('membership-employee-a', 'workspace-a', 'account-employee', 'employee', true),
      ('membership-inactive-a', 'workspace-a', 'account-inactive', 'admin', false)`,
    `INSERT INTO workspace_embed_preferences
      (workspace_id, default_mode, default_service_scope)
    VALUES
      ('workspace-a', 'floating', 'all'),
      ('workspace-b', 'inline', 'all')`,
  );
});

describe("workspace embed preference repository", () => {
  it("reads only the requested workspace preference", async () => {
    await expect(getWorkspaceEmbedPreference({ workspaceId: "workspace-a" }))
      .resolves.toEqual({
        workspaceId: "workspace-a",
        defaultMode: "floating",
        defaultServiceScope: "all",
      });
  });

  it("lets the active same-workspace administrator upsert idempotently", async () => {
    const admin = { membershipId: "membership-admin-a", workspaceId: "workspace-a" };
    const preference = { defaultMode: "inline" as const, defaultServiceScope: "all" as const };

    await expect(setWorkspaceEmbedPreference(admin, preference)).resolves.toBe(true);
    await expect(setWorkspaceEmbedPreference(admin, preference)).resolves.toBe(true);
    await expect(getWorkspaceEmbedPreference({ workspaceId: "workspace-a" }))
      .resolves.toMatchObject({ defaultMode: "inline", defaultServiceScope: "all" });
    const count = await database.prepare(
      "SELECT count(*) AS count FROM workspace_embed_preferences WHERE workspace_id = ?",
    ).bind("workspace-a").first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it.each([
    ["membership-employee-a", "workspace-a"],
    ["membership-inactive-a", "workspace-a"],
    ["membership-admin-a", "workspace-b"],
  ])("denies an unauthorized scope for %s", async (membershipId, workspaceId) => {
    await expect(setWorkspaceEmbedPreference(
      { membershipId, workspaceId },
      { defaultMode: "inline", defaultServiceScope: "all" },
    )).resolves.toBe(false);
    await expect(getWorkspaceEmbedPreference({ workspaceId: "workspace-a" }))
      .resolves.toMatchObject({ defaultMode: "floating" });
  });

  it("preserves the previous preference when the database rejects an update", async () => {
    await database.prepare(`
      CREATE TRIGGER reject_inline_preference
      BEFORE UPDATE ON workspace_embed_preferences
      WHEN NEW.default_mode = 'inline'
      BEGIN
        SELECT RAISE(ABORT, 'controlled preference failure');
      END
    `).run();
    try {
      await expect(setWorkspaceEmbedPreference(
        { membershipId: "membership-admin-a", workspaceId: "workspace-a" },
        { defaultMode: "inline", defaultServiceScope: "all" },
      )).rejects.toThrow();
      await expect(getWorkspaceEmbedPreference({ workspaceId: "workspace-a" }))
        .resolves.toMatchObject({ defaultMode: "floating" });
    } finally {
      await database.prepare("DROP TRIGGER reject_inline_preference").run();
    }
  });
});

async function runStatements(...statements: string[]) {
  for (const statement of statements) {
    await database.prepare(statement).run();
  }
}
