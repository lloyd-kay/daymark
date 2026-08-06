import { describe, expect, it } from "vitest";
import {
  WorkspaceAuthError,
  actorCanAccessProfile,
  requireRole,
  resolveWorkspaceActor,
} from "../lib/auth/membership";
import type {
  AccountSessionRecord,
  WorkspaceMembershipRecord,
} from "../lib/data/contracts";
import {
  normalizeWorkspaceSlug,
  workspaceSlugError,
} from "../lib/workspaces/slug";

const sessionActor: AccountSessionRecord = {
  accountId: "account-maya",
  email: "maya@example.com",
  displayName: "Maya Chen",
  active: true,
  mustChangePassword: false,
  idleExpiresAt: "2026-08-06T00:00:00.000Z",
  absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
};

const cedarMembership: WorkspaceMembershipRecord = {
  membershipId: "membership-maya",
  workspaceId: "workspace-cedar",
  workspaceName: "Cedar House",
  workspaceSlug: "cedar-house",
  accountId: "account-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  active: true,
};

describe("workspace slugs", () => {
  it("normalizes a company name into a stable booking slug", () => {
    expect(normalizeWorkspaceSlug(" Cedar House ")).toBe("cedar-house");
  });

  it.each(["api", "book", "embed", "get-daymark", "sign-in"])(
    "reserves the route name %s",
    (value) => expect(workspaceSlugError(value)).toBe("Choose a different booking URL."),
  );
});

describe("workspace actor resolution", () => {
  it("returns no actor without a session membership", () => {
    expect(resolveWorkspaceActor(null, cedarMembership)).toBeNull();
  });

  it("returns no actor for an inactive membership", () => {
    expect(
      resolveWorkspaceActor(sessionActor, { ...cedarMembership, active: false }),
    ).toBeNull();
  });

  it("returns no actor when the membership belongs to another account", () => {
    expect(
      resolveWorkspaceActor(sessionActor, {
        ...cedarMembership,
        accountId: "account-theo",
      }),
    ).toBeNull();
  });

  it("maps an active membership to a minimal workspace actor", () => {
    expect(resolveWorkspaceActor(sessionActor, cedarMembership)).toEqual({
      accountId: "account-maya",
      membershipId: "membership-maya",
      workspaceId: "workspace-cedar",
      workspaceName: "Cedar House",
      workspaceSlug: "cedar-house",
      employeeProfileId: "maya-chen",
      role: "employee",
      email: "maya@example.com",
      displayName: "Maya Chen",
      mustChangePassword: false,
    });
  });
});

describe("profile authorization", () => {
  it("allows an employee to access only their own profile", () => {
    const actor = resolveWorkspaceActor(sessionActor, cedarMembership)!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(false);
  });

  it("allows an administrator to access every profile", () => {
    const actor = resolveWorkspaceActor(sessionActor, {
      ...cedarMembership,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(true);
  });
});

describe("role guards", () => {
  it("rejects an employee from an administrator-only operation", () => {
    const actor = resolveWorkspaceActor(sessionActor, cedarMembership)!;

    expect(() => requireRole(actor, "admin")).toThrowError(WorkspaceAuthError);
  });

  it("accepts an administrator for an employee-capable operation", () => {
    const actor = resolveWorkspaceActor(sessionActor, {
      ...cedarMembership,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(requireRole(actor, "employee")).toBe(actor);
  });
});
