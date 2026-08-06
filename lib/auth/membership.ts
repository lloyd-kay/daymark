import { headers } from "vinext/shims/headers";
import type {
  AccountSessionRecord,
  WorkspaceMembershipRecord,
} from "../data/contracts";
import { hashOpaqueValue } from "./password";
import { sessionTokenFromRequest } from "./request-security";
import { findSessionActor, findWorkspaceMembership } from "./repository";

export type WorkspaceActor = {
  accountId: string;
  membershipId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  employeeProfileId: string | null;
  role: "admin" | "employee";
  email: string;
  displayName: string;
  mustChangePassword: boolean;
};

export class WorkspaceAuthError extends Error {
  readonly code: "unauthorized" | "forbidden";

  constructor(code: "unauthorized" | "forbidden") {
    super(code === "unauthorized" ? "Sign in is required." : "Access denied.");
    this.name = "WorkspaceAuthError";
    this.code = code;
  }
}

export function resolveWorkspaceActor(
  session: AccountSessionRecord | null,
  membership: WorkspaceMembershipRecord | null,
): WorkspaceActor | null {
  if (
    !session?.active
    || !membership?.active
    || session.accountId !== membership.accountId
  ) return null;

  return {
    accountId: session.accountId,
    membershipId: membership.membershipId,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    workspaceSlug: membership.workspaceSlug,
    employeeProfileId: membership.employeeProfileId,
    role: membership.role,
    email: session.email,
    displayName: session.displayName,
    mustChangePassword: session.mustChangePassword,
  };
}

export function actorCanAccessProfile(
  actor: WorkspaceActor,
  employeeProfileId: string,
): boolean {
  return (
    actor.role === "admin" || actor.employeeProfileId === employeeProfileId
  );
}

export function requireRole(
  actor: WorkspaceActor,
  minimumRole: "admin" | "employee",
): WorkspaceActor {
  if (minimumRole === "admin" && actor.role !== "admin") {
    throw new WorkspaceAuthError("forbidden");
  }
  return actor;
}

export async function getWorkspaceActor(
  workspaceSlug: string,
  request?: Request,
): Promise<WorkspaceActor | null> {
  const token = request
    ? sessionTokenFromRequest(request)
    : sessionTokenFromRequest(
        new Request("https://daymark.invalid", { headers: await headers() }),
      );
  if (!token) return null;
  const tokenHash = await hashOpaqueValue(token);
  const session = await findSessionActor(tokenHash);
  if (!session) return null;
  return resolveWorkspaceActor(
    session,
    await findWorkspaceMembership(session.accountId, workspaceSlug),
  );
}

export async function getAccountSession(
  request?: Request,
): Promise<AccountSessionRecord | null> {
  const token = request
    ? sessionTokenFromRequest(request)
    : sessionTokenFromRequest(
        new Request("https://daymark.invalid", { headers: await headers() }),
      );
  return token ? findSessionActor(await hashOpaqueValue(token)) : null;
}

export async function requireEmployeeActor(workspaceSlug: string): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor(workspaceSlug);
  if (!actor) throw new WorkspaceAuthError("unauthorized");
  return requireRole(actor, "employee");
}

export async function requireAdminActor(workspaceSlug: string): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor(workspaceSlug);
  if (!actor) throw new WorkspaceAuthError("unauthorized");
  return requireRole(actor, "admin");
}
