import { and, eq } from "drizzle-orm";
import { workspaces } from "../../db/schema";
import type { PublicBookingScope } from "../data/contracts";
import { normalizeWorkspaceSlug, workspaceSlugError } from "./slug";

export async function resolvePublicWorkspace(
  value: string,
): Promise<PublicBookingScope | null> {
  const workspaceSlug = normalizeWorkspaceSlug(value);
  if (workspaceSlugError(workspaceSlug) || workspaceSlug !== value) return null;
  const { getDb } = await import("../../db");
  const [workspace] = await getDb()
    .select({
      workspaceId: workspaces.id,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
    })
    .from(workspaces)
    .where(and(eq(workspaces.slug, workspaceSlug), eq(workspaces.active, true)))
    .limit(1);
  return workspace ?? null;
}
