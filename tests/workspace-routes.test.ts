import { describe, expect, it, vi } from "vitest";
import { createWorkspaceService } from "../lib/workspace-service";
import type { WorkspaceActor } from "../lib/auth/membership";

const employee: WorkspaceActor = {
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
  mustChangePassword: false,
};

const admin: WorkspaceActor = {
  membershipId: "membership-admin",
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
    createStaffAccount: vi.fn().mockResolvedValue({
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

  it("allows only administrators to create a staff account", async () => {
    const employeeDeps = dependencies(employee);
    const denied = await createWorkspaceService(employeeDeps).teamAction({
      action: "create-account",
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      displayName: "Theo Brooks",
      confirm: true,
    });
    expect(denied.status).toBe(403);
    expect(employeeDeps.createStaffAccount).not.toHaveBeenCalled();

    const adminDeps = dependencies(admin);
    const created = await createWorkspaceService(adminDeps).teamAction({
      action: "create-account",
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      displayName: "Theo Brooks",
      confirm: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.temporaryPassword).toMatch(/^[A-HJ-NP-Z2-9-]+$/);
    expect(adminDeps.createStaffAccount).toHaveBeenCalledWith(
      "membership-admin",
      {
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        displayName: "Theo Brooks",
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

  it("returns a temporary password only from successful create and reset responses", async () => {
    const deps = dependencies(admin);
    deps.listTeamProfiles.mockResolvedValue([
      {
        id: "maya-chen",
        memberEmail: "maya@example.com",
        hasCredential: true,
      },
    ]);
    const service = createWorkspaceService(deps);

    const reset = await service.teamAction({
      action: "reset-password",
      employeeProfileId: "maya-chen",
      confirm: true,
    });
    const team = await service.team();

    expect(reset).toEqual({
      status: 200,
      body: { temporaryPassword: "VWXYZ-23456-789AB-CDEFG" },
    });
    expect(JSON.stringify(team.body)).not.toMatch(/password/i);
  });

  it("validates account identifiers, normalized email, and display name", async () => {
    const deps = dependencies(admin);
    const service = createWorkspaceService(deps);

    for (const body of [
      {
        action: "create-account",
        employeeProfileId: "../maya",
        email: "maya@example.com",
        displayName: "Maya Chen",
        confirm: true,
      },
      {
        action: "create-account",
        employeeProfileId: "maya-chen",
        email: "not-an-email",
        displayName: "Maya Chen",
        confirm: true,
      },
      {
        action: "create-account",
        employeeProfileId: "maya-chen",
        email: "maya@example.com",
        displayName: " ",
        confirm: true,
      },
    ]) {
      const result = await service.teamAction(body);
      expect(result.status).toBe(400);
    }
    expect(deps.createStaffAccount).not.toHaveBeenCalled();

    await service.teamAction({
      action: "create-account",
      employeeProfileId: "maya-chen",
      email: "  MAYA@EXAMPLE.COM ",
      displayName: "  Maya Chen  ",
      confirm: true,
    });
    expect(deps.createStaffAccount).toHaveBeenCalledWith("membership-admin", {
      employeeProfileId: "maya-chen",
      email: "maya@example.com",
      displayName: "Maya Chen",
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
    );
  });
});
