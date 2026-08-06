import { beforeEach, describe, expect, it, vi } from "vitest";

const team = vi.hoisted(() => ({
  team: vi.fn(),
  teamAction: vi.fn(),
}));

vi.mock("../lib/workspace-runtime", () => ({ workspaceService: () => team }));

const origin = "https://daymark.example";

describe("workspace team route security", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects cross-origin mutations before parsing or invoking the service", async () => {
    const request = new Request(`${origin}/api/workspace/team`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: "not-json",
    });
    const parse = vi.spyOn(request, "json");
    const { POST } = await import("../app/api/workspace/team/route");

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: "Request origin not allowed.",
    });
    expect(parse).not.toHaveBeenCalled();
    expect(team.teamAction).not.toHaveBeenCalled();
  });

  it("parses and forwards same-origin mutations with no-store responses", async () => {
    team.teamAction.mockResolvedValue({
      status: 200,
      body: { temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV" },
    });
    const body = {
      action: "reset-password",
      employeeProfileId: "maya-chen",
      confirm: true,
    };
    const { POST } = await import("../app/api/workspace/team/route");

    const response = await POST(new Request(`${origin}/api/workspace/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(team.teamAction).toHaveBeenCalledWith(body);
  });

  it("marks team reads as no-store", async () => {
    team.team.mockResolvedValue({ status: 200, body: { profiles: [] } });
    const { GET } = await import("../app/api/workspace/team/route");

    const response = await GET(new Request(`${origin}/api/workspace/team?workspace=cedar-house`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
