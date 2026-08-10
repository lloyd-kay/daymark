import { beforeEach, describe, expect, it, vi } from "vitest";

const management = vi.hoisted(() => ({
  list: vi.fn(),
  mutate: vi.fn(),
}));

const serviceManagement = vi.hoisted(() => vi.fn(() => management));

vi.mock("../lib/service-management-runtime", () => ({ serviceManagement }));

const origin = "https://daymark.example";

describe("workspace services route security", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects cross-origin mutations before parsing or invoking the service", async () => {
    const request = new Request(`${origin}/api/workspace/services?workspace=cedar-house`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: "not-json",
    });
    const parse = vi.spyOn(request, "json");
    const { POST } = await import("../app/api/workspace/services/route");

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: "Request origin not allowed.",
    });
    expect(parse).not.toHaveBeenCalled();
    expect(management.mutate).not.toHaveBeenCalled();
  });

  it("forwards same-origin mutations with the workspace scope", async () => {
    management.mutate.mockResolvedValue({ status: 200, body: { ok: true } });
    const body = {
      action: "set-service-active",
      serviceId: "service-camera",
      active: false,
      confirm: true,
    };
    const request = new Request(`${origin}/api/workspace/services?workspace=cedar-house`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    });
    const { POST } = await import("../app/api/workspace/services/route");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(serviceManagement).toHaveBeenCalledWith("cedar-house", request);
    expect(management.mutate).toHaveBeenCalledWith(body);
  });

  it("marks administrator service reads as no-store", async () => {
    management.list.mockResolvedValue({ status: 200, body: { services: [] } });
    const request = new Request(`${origin}/api/workspace/services?workspace=cedar-house`);
    const { GET } = await import("../app/api/workspace/services/route");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(serviceManagement).toHaveBeenCalledWith("cedar-house", request);
    expect(management.list).toHaveBeenCalledOnce();
  });
});
