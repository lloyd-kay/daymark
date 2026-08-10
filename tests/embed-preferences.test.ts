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
    { action: "set-default", defaultMode: "drawer" },
    { action: "set-default", defaultMode: "inline", extra: true },
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
    });

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        preference: {
          workspaceId: "workspace-cedar",
          defaultMode: "inline",
          defaultServiceScope: "all",
        },
      },
    });
    expect(deps.setWorkspaceEmbedPreference).toHaveBeenCalledWith(
      { membershipId: "membership-admin", workspaceId: "workspace-cedar" },
      { defaultMode: "inline", defaultServiceScope: "all" },
    );
  });

  it.each([
    ["DM1-C-F-2ZE7", "floating"],
    ["dm1-c-i-355c", "inline"],
  ] as const)("imports %s idempotently as %s", async (code, defaultMode) => {
    const deps = dependencies();
    const service = createEmbedPreferences(deps);

    const first = await service.mutate({ action: "import-profile", code });
    const second = await service.mutate({ action: "import-profile", code });

    expect(first.status).toBe(200);
    expect(second).toMatchObject({
      status: 200,
      body: { preference: { defaultMode, defaultServiceScope: "all" } },
    });
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
    });

    expect(result).toEqual({
      status: 500,
      body: { ok: false, error: "The workspace default could not be saved. Try again." },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/database|filename|statement/i);
  });
});
