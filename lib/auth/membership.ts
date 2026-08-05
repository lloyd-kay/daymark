import type {
  AuthenticatedIdentity,
  MembershipRecord,
} from "../data/contracts";

export type WorkspaceActor = {
  membershipId: string;
  employeeProfileId: string | null;
  role: "admin" | "employee";
  email: string;
  displayName: string;
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
  identity: AuthenticatedIdentity | null,
  membership: MembershipRecord | null,
): WorkspaceActor | null {
  if (
    !identity ||
    !membership ||
    !membership.active ||
    membership.oaiUserId !== identity.userId
  ) {
    return null;
  }

  return {
    membershipId: membership.id,
    employeeProfileId: membership.employeeProfileId,
    role: membership.role,
    email: identity.email,
    displayName: identity.displayName,
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

export async function getWorkspaceActor(): Promise<WorkspaceActor | null> {
  const [{ getChatGPTUser }, { getMembershipByOaiUserId }] = await Promise.all([
    import("../../app/chatgpt-auth"),
    import("../data/repository"),
  ]);
  const user = await getChatGPTUser();
  if (!user) return null;
  const identity = {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
  };
  const membership = await getMembershipByOaiUserId(user.userId);
  return resolveWorkspaceActor(identity, membership);
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
