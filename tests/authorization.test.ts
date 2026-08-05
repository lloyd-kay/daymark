import { describe, expect, it } from "vitest";
import {
  WorkspaceAuthError,
  actorCanAccessProfile,
  requireRole,
  resolveWorkspaceActor,
} from "../lib/auth/membership";
import type {
  AuthenticatedIdentity,
  MembershipRecord,
} from "../lib/data/contracts";

const identity: AuthenticatedIdentity = {
  userId: "oai-user-1",
  email: "maya@example.com",
  displayName: "Maya Chen",
};

const employeeMembership: MembershipRecord = {
  id: "membership-maya",
  oaiUserId: identity.userId,
  email: identity.email,
  displayName: identity.displayName,
  role: "employee",
  active: true,
  employeeProfileId: "maya-chen",
};

describe("workspace actor resolution", () => {
  it("returns no actor for anonymous and unenrolled identities", () => {
    expect(resolveWorkspaceActor(null, employeeMembership)).toBeNull();
    expect(resolveWorkspaceActor(identity, null)).toBeNull();
  });

  it("returns no actor for an inactive membership", () => {
    expect(
      resolveWorkspaceActor(identity, { ...employeeMembership, active: false }),
    ).toBeNull();
  });

  it("rejects a membership belonging to another authenticated identity", () => {
    expect(
      resolveWorkspaceActor(identity, {
        ...employeeMembership,
        oaiUserId: "different-user",
      }),
    ).toBeNull();
  });

  it("maps an active membership to a minimal workspace actor", () => {
    expect(resolveWorkspaceActor(identity, employeeMembership)).toEqual({
      membershipId: "membership-maya",
      employeeProfileId: "maya-chen",
      role: "employee",
      email: "maya@example.com",
      displayName: "Maya Chen",
    });
  });
});

describe("profile authorization", () => {
  it("allows an employee to access only their own profile", () => {
    const actor = resolveWorkspaceActor(identity, employeeMembership)!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(false);
  });

  it("allows an administrator to access every profile", () => {
    const actor = resolveWorkspaceActor(identity, {
      ...employeeMembership,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(true);
  });
});

describe("role guards", () => {
  it("rejects an employee from an administrator-only operation", () => {
    const actor = resolveWorkspaceActor(identity, employeeMembership)!;

    expect(() => requireRole(actor, "admin")).toThrowError(WorkspaceAuthError);
  });

  it("accepts an administrator for an employee-capable operation", () => {
    const actor = resolveWorkspaceActor(identity, {
      ...employeeMembership,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(requireRole(actor, "employee")).toBe(actor);
  });
});
