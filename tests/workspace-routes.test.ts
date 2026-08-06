import { describe, expect, it, vi } from "vitest";
import { createWorkspaceService } from "../lib/workspace-service";
import type { WorkspaceActor } from "../lib/auth/membership";

const employee: WorkspaceActor = {
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
};

const admin: WorkspaceActor = {
  accountId: "account-admin",
  membershipId: "membership-admin",
  workspaceId: "workspace-cedar",
  workspaceName: "Cedar House",
  workspaceSlug: "cedar-house",
  employeeProfileId: null,
  role: "admin",
  email: "admin@example.com",
  displayName: "Admin User",
  mustChangePassword: false,
};

function dependencies(actor: WorkspaceActor | null) {
  return {
    getActor: vi.fn().mockResolvedValue(actor),
    listSchedule: vi.fn().mockResolvedValue([]),
    cancelAppointment: vi.fn().mockResolvedValue(true),
    getEmployeeAvailability: vi.fn().mockResolvedValue({ rules: [], blocked: [] }),
    replaceAvailabilityRules: vi.fn().mockResolvedValue(true),
    addBlockedPeriod: vi.fn().mockResolvedValue(true),
    listTeamProfiles: vi.fn().mockResolvedValue([]),
    createWorkspaceInvitation: vi.fn().mockResolvedValue({
      code: "private-invitation-code",
      expiresAt: "2026-08-13T00:00:00.000Z",
    }),
    createStaffAccount: vi.fn().mockResolvedValue({
      membershipId: "membership-theo",
      temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV",
    }),
    resetStaffPassword: vi.fn().mockResolvedValue({
      temporaryPassword: "VWXYZ-23456-789AB-CDEFG",
    }),
    setStaffActive: vi.fn().mockResolvedValue(true),
  };
}

describe("workspace schedule authorization", () => {
  it("rejects anonymous schedule reads with 401", async () => {
    const deps = dependencies(null);
    const service = createWorkspaceService(deps);

    const result = await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    });

    expect(result.status).toBe(401);
    expect(deps.listSchedule).not.toHaveBeenCalled();
  });

  it("requires a temporary password change before schedule reads", async () => {
    const deps = dependencies({ ...employee, mustChangePassword: true });
    const service = createWorkspaceService(deps);

    const result = await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    });

    expect(result).toEqual({
      status: 428,
      body: { ok: false, error: "Change your temporary password first." },
    });
    expect(deps.listSchedule).not.toHaveBeenCalled();
  });

  it("scopes an employee schedule read to their own profile", async () => {
    const deps = dependencies(employee);
    const service = createWorkspaceService(deps);

    await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    });

    expect(deps.listSchedule).toHaveBeenCalledWith(
      { workspaceId: "workspace-cedar", role: "employee", employeeProfileId: "maya-chen" },
      {
        from: "2026-08-05T00:00:00.000Z",
        to: "2026-08-12T00:00:00.000Z",
      },
      "maya-chen",
    );
  });

  it("rejects an employee request for another employee with 403", async () => {
    const deps = dependencies(employee);
    const service = createWorkspaceService(deps);

    const result = await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
      employeeId: "theo-brooks",
    });

    expect(result.status).toBe(403);
    expect(deps.listSchedule).not.toHaveBeenCalled();
  });

  it("allows an administrator to request the whole team", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    const result = await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    });

    expect(result.status).toBe(200);
    expect(deps.listSchedule).toHaveBeenCalledWith(
      { workspaceId: "workspace-cedar", role: "admin", employeeProfileId: null },
      expect.any(Object),
      undefined,
    );
  });
});

describe("workspace mutations", () => {
  it("requires explicit confirmation before cancelling an appointment", async () => {
    const deps = dependencies(employee);
    const service = createWorkspaceService(deps);

    const result = await service.cancel({
      appointmentId: "appointment-1",
      confirm: false,
    });

    expect(result.status).toBe(400);
    expect(deps.cancelAppointment).not.toHaveBeenCalled();
  });

  it("allows only administrators to create a private company invitation", async () => {
    const employeeDeps = dependencies(employee);
    const denied = await createWorkspaceService(employeeDeps).teamAction({
      action: "create-invitation",
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      role: "employee",
      confirm: true,
    });
    expect(denied.status).toBe(403);
    expect(employeeDeps.createWorkspaceInvitation).not.toHaveBeenCalled();

    const adminDeps = dependencies(admin);
    const created = await createWorkspaceService(adminDeps).teamAction({
      action: "create-invitation",
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      role: "employee",
      confirm: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe("private-invitation-code");
    expect(adminDeps.createWorkspaceInvitation).toHaveBeenCalledWith(
      "membership-admin",
      {
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        role: "employee",
      },
    );
  });

  it("requires explicit confirmation before resetting a staff password", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    const result = await service.teamAction({
      action: "reset-password",
      employeeProfileId: "maya-chen",
      confirm: false,
    });

    expect(result.status).toBe(400);
    expect(deps.resetStaffPassword).not.toHaveBeenCalled();
  });

  it("prevents employees from resetting a staff password", async () => {
    const deps = dependencies(employee);
    const result = await createWorkspaceService(deps).teamAction({
      action: "reset-password",
      employeeProfileId: "maya-chen",
      confirm: true,
    });

    expect(result.status).toBe(403);
    expect(deps.resetStaffPassword).not.toHaveBeenCalled();
  });

  it("never includes other-company membership information in team responses", async () => {
    const deps = dependencies(admin);
    deps.listTeamProfiles.mockResolvedValue([
      {
        id: "maya-chen",
        memberEmail: "maya@example.com",
        hasCredential: true,
      },
    ]);
    const service = createWorkspaceService(deps);

    const invitation = await service.teamAction({
      action: "create-invitation",
      employeeProfileId: "maya-chen",
      email: "maya@example.com",
      role: "employee",
      confirm: true,
    });
    const team = await service.team();

    expect(invitation.status).toBe(201);
    expect(JSON.stringify(team.body)).not.toMatch(/otherWorkspace|membershipCount/i);
  });

  it("validates invitation identifiers and normalizes email", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    for (const body of [
      {
        action: "create-invitation",
        employeeProfileId: "../maya",
        email: "maya@example.com",
        role: "employee",
        confirm: true,
      },
      {
        action: "create-invitation",
        employeeProfileId: "maya-chen",
        email: "not-an-email",
        role: "employee",
        confirm: true,
      },
    ]) {
      const result = await service.teamAction(body);
      expect(result.status).toBe(400);
    }
    expect(deps.createWorkspaceInvitation).not.toHaveBeenCalled();

    await service.teamAction({
      action: "create-invitation",
      employeeProfileId: "maya-chen",
      email: "  MAYA@EXAMPLE.COM ",
      role: "employee",
      confirm: true,
    });
    expect(deps.createWorkspaceInvitation).toHaveBeenCalledWith("membership-admin", {
      employeeProfileId: "maya-chen",
      email: "maya@example.com",
      role: "employee",
    });
  });

  it("requires confirmation before an administrator changes staff active state", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    const result = await service.teamAction({
      action: "set-active",
      employeeProfileId: "maya-chen",
      active: false,
      confirm: false,
    });

    expect(result.status).toBe(400);
    expect(deps.setStaffActive).not.toHaveBeenCalled();
  });

  it("routes confirmed deactivation through the staff lifecycle", async () => {
    const deps = dependencies(admin);
    const result = await createWorkspaceService(deps).teamAction({
      action: "set-active",
      employeeProfileId: "maya-chen",
      active: false,
      confirm: true,
    });

    expect(result.status).toBe(200);
    expect(deps.setStaffActive).toHaveBeenCalledWith(
      "membership-admin",
      "maya-chen",
      false,
      true,
    );
  });
});
