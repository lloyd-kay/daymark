import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceActor } from "../lib/auth/membership";
import type { WorkspaceEmbedPreference } from "../lib/data/contracts";
import { createEmbedPreferences } from "../lib/embed-preferences";

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
};

function dependencies(actor: WorkspaceActor | null = admin) {
  let stored: WorkspaceEmbedPreference = {
    workspaceId: "workspace-cedar",
    defaultMode: "floating",
    defaultServiceScope: "all",
    defaultServiceId: null,
  };
  return {
    getActor: vi.fn().mockResolvedValue(actor),
    getWorkspaceEmbedPreference: vi.fn(async () => stored),
    setWorkspaceEmbedPreference: vi.fn(async (_scope, input) => {
      stored = { ...stored, ...input };
      return true;
    }),
  };
}

describe("protected Embed preference reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [null, 401],
    [{ ...admin, mustChangePassword: true }, 428],
    [employee, 403],
  ] as const)("denies a non-ready actor with status %s", async (actor, status) => {
    const deps = dependencies(actor);
    const result = await createEmbedPreferences(deps).read();

    expect(result.status).toBe(status);
    expect(deps.getWorkspaceEmbedPreference).not.toHaveBeenCalled();
  });

  it("reads only the authenticated administrator workspace", async () => {
    const deps = dependencies();

    await expect(createEmbedPreferences(deps).read()).resolves.toEqual({
      status: 200,
      body: {
        preference: {
          workspaceId: "workspace-cedar",
          defaultMode: "floating",
          defaultServiceScope: "all",
          defaultServiceId: null,
        },
      },
    });
    expect(deps.getWorkspaceEmbedPreference).toHaveBeenCalledWith({
      workspaceId: "workspace-cedar",
    });
  });
});

describe("Embed preference mutations", () => {
  it.each([
    null,
    {},
    { action: "unknown" },
    { action: "set-default", defaultMode: "inline", defaultServiceScope: "all" },
    { action: "set-default", defaultMode: "drawer", defaultServiceScope: "all", serviceId: null },
    { action: "set-default", defaultMode: "inline", defaultServiceScope: "all", serviceId: null, extra: true },
    { action: "set-default", defaultMode: "inline", defaultServiceScope: "all", serviceId: 42 },
    { action: "import-profile", code: "DM1-C-F-2ZE7" },
    { action: "import-profile", code: "DM1-C-F-2ZE7", serviceId: null, extra: true },
  ])("rejects malformed mutation %j before storage", async (input) => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate(input);

    expect(result.status).toBe(400);
    expect(deps.setWorkspaceEmbedPreference).not.toHaveBeenCalled();
  });

  it("sets a normalized full-catalogue default in the actor workspace", async () => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate({
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "all",
      serviceId: null,
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        preference: {
          workspaceId: "workspace-cedar",
          defaultMode: "inline",
          defaultServiceScope: "all",
          defaultServiceId: null,
        },
      },
    });
    expect(deps.setWorkspaceEmbedPreference).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      { defaultMode: "inline", defaultServiceScope: "all", defaultServiceId: null },
    );
  });

  it("sets an explicit internal service default in the actor workspace", async () => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate({
      action: "set-default",
      defaultMode: "floating",
      defaultServiceScope: "service",
      serviceId: "service-camera",
    });

    expect(result).toMatchObject({
      status: 200,
      body: {
        preference: {
          defaultMode: "floating",
          defaultServiceScope: "service",
          defaultServiceId: "service-camera",
        },
      },
    });
    expect(deps.setWorkspaceEmbedPreference).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      {
        defaultMode: "floating",
        defaultServiceScope: "service",
        defaultServiceId: "service-camera",
      },
    );
  });

  it.each([
    ["catalogue scope with a service", {
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "all",
      serviceId: "service-camera",
    }],
    ["service scope without a service", {
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "service",
      serviceId: null,
    }],
    ["an unsafe service ID", {
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "service",
      serviceId: "camera service",
    }],
  ])("rejects %s before storage", async (_label, input) => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate(input);

    expect(result.status).toBe(400);
    expect(deps.setWorkspaceEmbedPreference).not.toHaveBeenCalled();
  });

  it.each([
    ["DM1-C-F-2ZE7", null, "floating", "all", null],
    ["dm2-c-i-2sps", null, "inline", "all", null],
    ["DM2-P-F-34D6", "service-camera", "floating", "service", "service-camera"],
  ] as const)(
    "imports %s idempotently with the requested service mapping",
    async (code, serviceId, defaultMode, defaultServiceScope, defaultServiceId) => {
    const deps = dependencies();
    const service = createEmbedPreferences(deps);

    const first = await service.mutate({ action: "import-profile", code, serviceId });
    const second = await service.mutate({ action: "import-profile", code, serviceId });

    expect(first.status).toBe(200);
    expect(second).toMatchObject({
      status: 200,
      body: { preference: { defaultMode, defaultServiceScope, defaultServiceId } },
    });
    expect(deps.setWorkspaceEmbedPreference).toHaveBeenLastCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      { defaultMode, defaultServiceScope, defaultServiceId },
    );
  });

  it.each([
    ["catalogue import with a service", { action: "import-profile", code: "DM2-C-F-36UR", serviceId: "service-camera" }],
    ["page import without a service", { action: "import-profile", code: "DM2-P-I-2Y6D", serviceId: null }],
    ["page import with an unsafe service", { action: "import-profile", code: "DM2-P-I-2Y6D", serviceId: "camera service" }],
  ])("rejects %s before storage", async (_label, input) => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate(input);

    expect(result.status).toBe(400);
    expect(deps.setWorkspaceEmbedPreference).not.toHaveBeenCalled();
  });

  it.each([
    ["DM1-C-F-2ZE8", "That setup code looks incomplete or mistyped."],
    ["DM3-C-F-2GA8", "Update Daymark before importing this setup code."],
    ["DM1-C-X-2ZE7", "That setup code is not valid."],
  ])("maps invalid code %s to safe guidance", async (code, message) => {
    const deps = dependencies();

    const result = await createEmbedPreferences(deps).mutate({
      action: "import-profile",
      code,
      serviceId: null,
    });

    expect(result).toEqual({ status: 400, body: { ok: false, error: message } });
    expect(JSON.stringify(result.body)).not.toContain(code);
    expect(deps.setWorkspaceEmbedPreference).not.toHaveBeenCalled();
  });

  it("denies a repository authorization miss without exposing workspace details", async () => {
    const deps = dependencies();
    deps.setWorkspaceEmbedPreference.mockResolvedValueOnce(false);

    const result = await createEmbedPreferences(deps).mutate({
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "all",
      serviceId: null,
    });

    expect(result).toEqual({
      status: 403,
      body: { ok: false, error: "You do not have access to that." },
    });
  });

  it("returns retry guidance and preserves storage when the database fails", async () => {
    const deps = dependencies();
    deps.setWorkspaceEmbedPreference.mockRejectedValueOnce(
      new Error("internal database filename and statement"),
    );

    const result = await createEmbedPreferences(deps).mutate({
      action: "set-default",
      defaultMode: "inline",
      defaultServiceScope: "all",
      serviceId: null,
    });

    expect(result).toEqual({
      status: 500,
      body: { ok: false, error: "The workspace default could not be saved. Try again." },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/database|filename|statement/i);
  });
});
