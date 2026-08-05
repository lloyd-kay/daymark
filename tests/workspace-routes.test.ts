import { describe, expect, it, vi } from "vitest";
import { createWorkspaceService } from "../lib/workspace-service";
import type { WorkspaceActor } from "../lib/auth/membership";

const employee: WorkspaceActor = {
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
};

const admin: WorkspaceActor = {
  membershipId: "membership-admin",
  employeeProfileId: null,
  role: "admin",
  email: "admin@example.com",
  displayName: "Admin User",
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
    createInvitation: vi.fn().mockResolvedValue({
      code: "DAYMARK-ABC123",
      expiresAt: "2026-08-12T12:00:00.000Z",
    }),
    setEmployeeActive: vi.fn().mockResolvedValue(true),
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

  it("scopes an employee schedule read to their own profile", async () => {
    const deps = dependencies(employee);
    const service = createWorkspaceService(deps);

    await service.schedule({
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    });

    expect(deps.listSchedule).toHaveBeenCalledWith(
      { role: "employee", employeeProfileId: "maya-chen" },
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
      { role: "admin", employeeProfileId: null },
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

  it("allows only administrators to create invitations", async () => {
    const employeeDeps = dependencies(employee);
    const employeeResult = await createWorkspaceService(employeeDeps).teamAction({
      action: "invite",
      employeeProfileId: "maya-chen",
      confirm: true,
    });
    expect(employeeResult.status).toBe(403);
    expect(employeeDeps.createInvitation).not.toHaveBeenCalled();

    const adminDeps = dependencies(admin);
    const adminResult = await createWorkspaceService(adminDeps).teamAction({
      action: "invite",
      employeeProfileId: "maya-chen",
      confirm: true,
    });
    expect(adminResult.status).toBe(200);
    expect(adminDeps.createInvitation).toHaveBeenCalledWith(
      "membership-admin",
      "maya-chen",
    );
  });

  it("requires confirmation before an administrator deactivates a profile", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    const result = await service.teamAction({
      action: "set-active",
      employeeProfileId: "maya-chen",
      active: false,
      confirm: false,
    });

    expect(result.status).toBe(400);
    expect(deps.setEmployeeActive).not.toHaveBeenCalled();
  });
});
