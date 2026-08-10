import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceActor } from "../lib/auth/membership";
import { createServiceManagement } from "../lib/service-management";

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

const employee: WorkspaceActor = {
  ...admin,
  accountId: "account-maya",
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
};

function dependencies(actor: WorkspaceActor | null = admin) {
  return {
    getActor: vi.fn().mockResolvedValue(actor),
    listWorkspaceServices: vi.fn().mockResolvedValue([]),
    createWorkspaceService: vi.fn().mockResolvedValue(true),
    updateWorkspaceService: vi.fn().mockResolvedValue(true),
    setWorkspaceServiceActive: vi.fn().mockResolvedValue(true),
    setEmployeeServiceQualification: vi.fn().mockResolvedValue(true),
  };
}

describe("protected service catalogue reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies service data to an employee before invoking storage", async () => {
    const deps = dependencies(employee);

    const result = await createServiceManagement(deps).list();

    expect(result.status).toBe(403);
    expect(deps.listWorkspaceServices).not.toHaveBeenCalled();
  });

  it("requires authentication and a completed temporary-password change", async () => {
    const anonymous = dependencies(null);
    expect((await createServiceManagement(anonymous).list()).status).toBe(401);
    expect(anonymous.listWorkspaceServices).not.toHaveBeenCalled();

    const temporary = dependencies({ ...admin, mustChangePassword: true });
    expect((await createServiceManagement(temporary).list()).status).toBe(428);
    expect(temporary.listWorkspaceServices).not.toHaveBeenCalled();
  });

  it("lists only the authenticated administrator workspace", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).list();

    expect(result).toEqual({ status: 200, body: { services: [] } });
    expect(deps.listWorkspaceServices).toHaveBeenCalledWith({
      workspaceId: "workspace-cedar",
    });
  });
});

describe("service management mutations", () => {
  it("normalizes bounded service details before creation", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "create-service",
      name: "  Camera installation  ",
      category: "  Smart security  ",
      description: "  Install and configure a camera.  ",
      durationMinutes: 90,
    });

    expect(result).toEqual({ status: 201, body: { ok: true } });
    expect(deps.createWorkspaceService).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      {
        name: "Camera installation",
        category: "Smart security",
        description: "Install and configure a camera.",
        durationMinutes: 90,
      },
    );
  });

  it.each([
    { name: "", category: "Security", description: "", durationMinutes: 60 },
    { name: "x".repeat(81), category: "Security", description: "", durationMinutes: 60 },
    { name: "Camera", category: "x".repeat(81), description: "", durationMinutes: 60 },
    { name: "Camera", category: "Security", description: "x".repeat(501), durationMinutes: 60 },
    { name: "Camera", category: "Security", description: "", durationMinutes: 61 },
  ])("rejects invalid service details before storage", async (input) => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "create-service",
      ...input,
    });

    expect(result.status).toBe(400);
    expect(deps.createWorkspaceService).not.toHaveBeenCalled();
  });

  it("updates service details without accepting a replacement slug", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "update-service",
      serviceId: "service-camera",
      slug: "replacement-slug",
      name: "Camera setup",
      category: "Security",
      description: "Camera installation and setup.",
      durationMinutes: 75,
    });

    expect(result.status).toBe(200);
    expect(deps.updateWorkspaceService).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      {
        serviceId: "service-camera",
        name: "Camera setup",
        category: "Security",
        description: "Camera installation and setup.",
        durationMinutes: 75,
      },
    );
  });

  it("requires confirmation before service deactivation", async () => {
    const deps = dependencies();

    const denied = await createServiceManagement(deps).mutate({
      action: "set-service-active",
      serviceId: "service-camera",
      active: false,
    });

    expect(denied.status).toBe(400);
    expect(deps.setWorkspaceServiceActive).not.toHaveBeenCalled();

    const accepted = await createServiceManagement(deps).mutate({
      action: "set-service-active",
      serviceId: "service-camera",
      active: false,
      confirm: true,
    });

    expect(accepted.status).toBe(200);
    expect(deps.setWorkspaceServiceActive).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      "service-camera",
      false,
    );
  });

  it("requires certificate name and expiry for certificate-backed approval", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "set-qualification",
      serviceId: "service-camera",
      employeeProfileId: "maya-chen",
      active: true,
      method: "certificate",
      certificateName: "",
      certificateReference: null,
      issuedOn: null,
      expiresOn: null,
    });

    expect(result.status).toBe(400);
    expect(deps.setEmployeeServiceQualification).not.toHaveBeenCalled();
  });

  it("rejects malformed certificate dates and issue dates after expiry", async () => {
    const deps = dependencies();
    const service = createServiceManagement(deps);

    expect((await service.mutate({
      action: "set-qualification",
      serviceId: "service-camera",
      employeeProfileId: "maya-chen",
      active: true,
      method: "certificate",
      certificateName: "Alarm installer",
      certificateReference: "CERT-104",
      issuedOn: "10/08/2026",
      expiresOn: "2027-08-10",
    })).status).toBe(400);
    expect((await service.mutate({
      action: "set-qualification",
      serviceId: "service-camera",
      employeeProfileId: "maya-chen",
      active: true,
      method: "certificate",
      certificateName: "Alarm installer",
      certificateReference: "CERT-104",
      issuedOn: "2027-08-11",
      expiresOn: "2027-08-10",
    })).status).toBe(400);
    expect(deps.setEmployeeServiceQualification).not.toHaveBeenCalled();
  });

  it("forwards a valid certificate-backed approval", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "set-qualification",
      serviceId: "service-alarm",
      employeeProfileId: "maya-chen",
      active: true,
      method: "certificate",
      certificateName: "  Eufy alarm installer  ",
      certificateReference: "  CERT-104  ",
      issuedOn: "2026-08-10",
      expiresOn: "2027-08-10",
    });

    expect(result.status).toBe(200);
    expect(deps.setEmployeeServiceQualification).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      {
        serviceId: "service-alarm",
        employeeProfileId: "maya-chen",
        active: true,
        method: "certificate",
        certificateName: "Eufy alarm installer",
        certificateReference: "CERT-104",
        issuedOn: "2026-08-10",
        expiresOn: "2027-08-10",
      },
    );
  });

  it("clears certificate fields for manual approval", async () => {
    const deps = dependencies();

    await createServiceManagement(deps).mutate({
      action: "set-qualification",
      serviceId: "service-camera",
      employeeProfileId: "maya-chen",
      active: true,
      method: "manual",
      certificateName: "old certificate",
      certificateReference: "old reference",
      issuedOn: "2026-08-10",
      expiresOn: "2027-08-10",
    });

    expect(deps.setEmployeeServiceQualification).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        method: "manual",
        certificateName: null,
        certificateReference: null,
        issuedOn: null,
        expiresOn: null,
      }),
    );
  });

  it("requires confirmation when removing a qualification", async () => {
    const deps = dependencies();

    const result = await createServiceManagement(deps).mutate({
      action: "set-qualification",
      serviceId: "service-camera",
      employeeProfileId: "maya-chen",
      active: false,
      method: "manual",
      certificateName: null,
      certificateReference: null,
      issuedOn: null,
      expiresOn: null,
    });

    expect(result.status).toBe(400);
    expect(deps.setEmployeeServiceQualification).not.toHaveBeenCalled();
  });

  it("denies every mutation to an employee", async () => {
    const deps = dependencies(employee);

    const result = await createServiceManagement(deps).mutate({
      action: "create-service",
      name: "Camera installation",
      category: "Security",
      description: "",
      durationMinutes: 60,
    });

    expect(result.status).toBe(403);
    expect(deps.createWorkspaceService).not.toHaveBeenCalled();
  });
});
