import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listPublicServices: vi.fn(),
  listPublicEmployees: vi.fn(),
  listPublicSlots: vi.fn(),
  createBooking: vi.fn(),
}));

const scope = {
  workspaceId: "workspace-cedar",
  workspaceSlug: "cedar-house",
  workspaceName: "Cedar House",
};
const resolvePublicWorkspace = vi.hoisted(() => vi.fn());

vi.mock("../lib/data/repository", () => repository);
vi.mock("../lib/workspaces/public-scope", () => ({ resolvePublicWorkspace }));

const service = {
  id: "service-camera",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Smart security",
  description: "Install and configure a camera.",
  durationMinutes: 90,
};
const employee = {
  id: "maya-chen",
  publicName: "Maya Chen",
  title: "Installer",
  bio: "Camera specialist.",
  accent: "coral",
};

describe("public service-aware routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePublicWorkspace.mockResolvedValue(scope);
    repository.listPublicServices.mockResolvedValue([service]);
    repository.listPublicEmployees.mockResolvedValue([employee]);
    repository.listPublicSlots.mockResolvedValue({ service, employee, slots: [] });
  });

  it("returns a no-store service catalogue filtered by a valid employee", async () => {
    const { GET } = await import("../app/api/public/[workspaceSlug]/services/route");

    const response = await GET(
      new Request("https://daymark.example/api/public/cedar-house/services?employeeId=maya-chen"),
      { params: { workspaceSlug: "cedar-house" } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ services: [service] });
    expect(repository.listPublicServices).toHaveBeenCalledWith(
      scope,
      "maya-chen",
      expect.any(Date),
    );
  });

  it("passes selected service context to employee and slot lookups", async () => {
    const employeesRoute = await import("../app/api/public/[workspaceSlug]/employees/route");
    const slotsRoute = await import("../app/api/public/[workspaceSlug]/slots/route");

    const employeesResponse = await employeesRoute.GET(
      new Request("https://daymark.example/api/public/cedar-house/employees?serviceId=service-camera"),
      { params: { workspaceSlug: "cedar-house" } },
    );
    const slotsResponse = await slotsRoute.GET(
      new Request("https://daymark.example/api/public/cedar-house/slots?serviceId=service-camera&employeeId=maya-chen&from=2026-08-10"),
      { params: { workspaceSlug: "cedar-house" } },
    );

    expect(employeesResponse.status).toBe(200);
    expect(repository.listPublicEmployees).toHaveBeenCalledWith(
      scope,
      "service-camera",
      expect.any(Date),
    );
    expect(slotsResponse.status).toBe(200);
    expect(repository.listPublicSlots).toHaveBeenCalledWith(
      scope,
      "service-camera",
      "maya-chen",
      expect.any(Array),
      expect.any(Date),
    );
    expect(JSON.stringify(await slotsResponse.json())).not.toMatch(/certificate|expiresOn|issuedOn/i);
  });

  it("returns the same generic not-found response before repository access", async () => {
    resolvePublicWorkspace.mockResolvedValue(null);
    const { GET } = await import("../app/api/public/[workspaceSlug]/services/route");

    const response = await GET(
      new Request("https://daymark.example/api/public/unknown/services"),
      { params: { workspaceSlug: "unknown" } },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Booking page not found.",
    });
    expect(repository.listPublicServices).not.toHaveBeenCalled();
  });
});
