import { eq, sql } from "drizzle-orm";
import { workspaceEmbedPreferences } from "../../db/schema";
import type { WorkspaceEmbedPreference } from "./contracts";

export type EmbedPreferenceAdminScope = {
  membershipId: string;
  workspaceId: string;
};

export async function getWorkspaceEmbedPreference(
  scope: { workspaceId: string },
): Promise<WorkspaceEmbedPreference> {
  const db = await database();
  const [preference] = await db
    .select({
      workspaceId: workspaceEmbedPreferences.workspaceId,
      defaultMode: workspaceEmbedPreferences.defaultMode,
      defaultServiceScope: workspaceEmbedPreferences.defaultServiceScope,
    })
    .from(workspaceEmbedPreferences)
    .where(eq(workspaceEmbedPreferences.workspaceId, scope.workspaceId))
    .limit(1);
  if (!preference) {
    throw new Error("Workspace Embed preference is unavailable");
  }
  return preference;
}

export async function setWorkspaceEmbedPreference(
  admin: EmbedPreferenceAdminScope,
  input: Pick<WorkspaceEmbedPreference, "defaultMode" | "defaultServiceScope">,
): Promise<boolean> {
  if (
    !validOpaqueId(admin.membershipId)
    || !validOpaqueId(admin.workspaceId)
    || (input.defaultMode !== "floating" && input.defaultMode !== "inline")
    || input.defaultServiceScope !== "all"
  ) {
    return false;
  }

  const db = await database();
  const result = await db.run(sql`
    INSERT INTO workspace_embed_preferences
      (workspace_id, default_mode, default_service_scope, created_at, updated_at)
    SELECT
      ${admin.workspaceId}, ${input.defaultMode}, ${input.defaultServiceScope},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE EXISTS (
      SELECT 1
      FROM memberships
      INNER JOIN workspaces ON workspaces.id = memberships.workspace_id
      WHERE memberships.id = ${admin.membershipId}
        AND memberships.workspace_id = ${admin.workspaceId}
        AND memberships.role = 'admin'
        AND memberships.active = true
        AND workspaces.active = true
    )
    ON CONFLICT(workspace_id) DO UPDATE SET
      default_mode = excluded.default_mode,
      default_service_scope = excluded.default_service_scope,
      updated_at = CURRENT_TIMESTAMP
  `);
  return result.meta.changes === 1;
}

function validOpaqueId(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
}

async function database() {
  const { getDb } = await import("../../db");
  return getDb();
}
