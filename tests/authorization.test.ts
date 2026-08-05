import { describe, expect, it } from "vitest";
import {
  WorkspaceAuthError,
  actorCanAccessProfile,
  requireRole,
  resolveWorkspaceActor,
} from "../lib/auth/membership";
import type { SessionActorRecord } from "../lib/data/contracts";

const sessionActor: SessionActorRecord = {
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
  active: true,
  mustChangePassword: false,
  idleExpiresAt: "2026-08-06T00:00:00.000Z",
  absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
};

describe("workspace actor resolution", () => {
  it("returns no actor without a session membership", () => {
    expect(resolveWorkspaceActor(null)).toBeNull();
  });

  it("returns no actor for an inactive membership", () => {
    expect(resolveWorkspaceActor({ ...sessionActor, active: false })).toBeNull();
  });

  it("maps an active membership to a minimal workspace actor", () => {
    expect(resolveWorkspaceActor(sessionActor)).toEqual({
      membershipId: "membership-maya",
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
    const actor = resolveWorkspaceActor(sessionActor)!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(false);
  });

  it("allows an administrator to access every profile", () => {
    const actor = resolveWorkspaceActor({
      ...sessionActor,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(actorCanAccessProfile(actor, "maya-chen")).toBe(true);
    expect(actorCanAccessProfile(actor, "theo-brooks")).toBe(true);
  });
});

describe("role guards", () => {
  it("rejects an employee from an administrator-only operation", () => {
    const actor = resolveWorkspaceActor(sessionActor)!;

    expect(() => requireRole(actor, "admin")).toThrowError(WorkspaceAuthError);
  });

  it("accepts an administrator for an employee-capable operation", () => {
    const actor = resolveWorkspaceActor({
      ...sessionActor,
      role: "admin",
      employeeProfileId: null,
    })!;

    expect(requireRole(actor, "employee")).toBe(actor);
  });
});
