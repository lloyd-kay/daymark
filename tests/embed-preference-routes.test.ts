import { beforeEach, describe, expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({
  read: vi.fn(),
  mutate: vi.fn(),
}));
const embedPreferences = vi.hoisted(() => vi.fn(() => preferences));

vi.mock("../lib/embed-preferences-runtime", () => ({ embedPreferences }));

const origin = "https://daymark.example";

describe("workspace Embed preference route security", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects cross-origin mutations before parsing or invoking the service", async () => {
    const request = new Request(
      `${origin}/api/workspace/embed-preferences?workspace=cedar-house`,
      {
        method: "POST",
        headers: { origin: "https://attacker.example" },
        body: "not-json",
      },
    );
    const parse = vi.spyOn(request, "json");
    const { POST } = await import("../app/api/workspace/embed-preferences/route");

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: "Request origin not allowed.",
    });
    expect(parse).not.toHaveBeenCalled();
    expect(preferences.mutate).not.toHaveBeenCalled();
  });

  it("forwards same-origin parsed JSON with the workspace scope", async () => {
    preferences.mutate.mockResolvedValue({
      status: 200,
      body: { ok: true, preference: { defaultMode: "inline" } },
    });
    const body = { action: "import-profile", code: "DM1-C-I-355C" };
    const request = new Request(
      `${origin}/api/workspace/embed-preferences?workspace=cedar-house`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", origin },
        body: JSON.stringify(body),
      },
    );
    const { POST } = await import("../app/api/workspace/embed-preferences/route");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(embedPreferences).toHaveBeenCalledWith("cedar-house", request);
    expect(preferences.mutate).toHaveBeenCalledWith(body);
  });

  it("marks administrator reads as no-store", async () => {
    preferences.read.mockResolvedValue({
      status: 200,
      body: { preference: { defaultMode: "floating" } },
    });
    const request = new Request(
      `${origin}/api/workspace/embed-preferences?workspace=cedar-house`,
    );
    const { GET } = await import("../app/api/workspace/embed-preferences/route");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(embedPreferences).toHaveBeenCalledWith("cedar-house", request);
    expect(preferences.read).toHaveBeenCalledOnce();
  });
});
