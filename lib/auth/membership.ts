import { headers } from "vinext/shims/headers";
import type { SessionActorRecord } from "../data/contracts";
import { hashOpaqueValue } from "./password";
import { sessionTokenFromRequest } from "./request-security";
import { findSessionActor } from "./repository";

export type WorkspaceActor = {
  membershipId: string;
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
  membership: SessionActorRecord | null,
): WorkspaceActor | null {
  if (!membership?.active) return null;

  return {
    membershipId: membership.membershipId,
    employeeProfileId: membership.employeeProfileId,
    role: membership.role,
    email: membership.email,
    displayName: membership.displayName,
    mustChangePassword: membership.mustChangePassword,
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
  request?: Request,
): Promise<WorkspaceActor | null> {
  const token = request
    ? sessionTokenFromRequest(request)
    : sessionTokenFromRequest(
        new Request("https://daymark.invalid", { headers: await headers() }),
      );
  if (!token) return null;
  const tokenHash = await hashOpaqueValue(token);
  return resolveWorkspaceActor(await findSessionActor(tokenHash));
}

export async function requireEmployeeActor(): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor();
  if (!actor) throw new WorkspaceAuthError("unauthorized");
  return requireRole(actor, "employee");
}

export async function requireAdminActor(): Promise<WorkspaceActor> {
  const actor = await getWorkspaceActor();
  if (!actor) throw new WorkspaceAuthError("unauthorized");
  return requireRole(actor, "admin");
}
