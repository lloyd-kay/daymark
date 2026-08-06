import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  setup: vi.fn(),
  signIn: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("../lib/auth/runtime", () => ({ authService: () => auth }));
vi.mock("cloudflare:workers", () => ({
  env: { DAYMARK_SETUP_CODE: "setup-secret" },
}));

const origin = "https://daymark.example";

function request(path: string, body: Record<string, unknown>, headers?: HeadersInit) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  });
}

describe("authentication routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects cross-origin setup before parsing or calling the service", async () => {
    const { POST } = await import("../app/api/auth/setup/route");
    const response = await POST(new Request(`${origin}/api/auth/setup`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: "not json",
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(auth.setup).not.toHaveBeenCalled();
  });

  it("sets an opaque session cookie after successful administrator setup", async () => {
    auth.setup.mockResolvedValue({
      status: 200,
      body: {
        ok: true,
        mustChangePassword: false,
        workspaceSlug: "cedar-house",
      },
      session: {
        token: "opaque-token",
        expiresAt: "2026-08-12T12:00:00.000Z",
      },
    });
    const { POST } = await import("../app/api/auth/setup/route");
    const response = await POST(request("/api/auth/setup", {
      setupCode: "setup-secret",
      workspaceName: "Cedar House",
      workspaceSlug: "cedar-house",
      displayName: "Maya Chen",
      email: "maya@example.com",
      password: "a secure password",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("daymark_session=opaque-token");
    expect(auth.setup).toHaveBeenCalledWith({
      setupCode: "setup-secret",
      workspaceName: "Cedar House",
      workspaceSlug: "cedar-house",
      displayName: "Maya Chen",
      email: "maya@example.com",
      password: "a secure password",
    }, "setup-secret");
  });

  it("requires company identity fields during first-time setup", async () => {
    const { POST } = await import("../app/api/auth/setup/route");
    const response = await POST(request("/api/auth/setup", {
      setupCode: "setup-secret",
      displayName: "Maya Chen",
      email: "maya@example.com",
      password: "a secure password",
    }));

    expect(response.status).toBe(400);
    expect(auth.setup).not.toHaveBeenCalled();
  });

  it("sets the session cookie and supplies a request fingerprint on sign-in", async () => {
    auth.signIn.mockResolvedValue({
      status: 200,
      body: { ok: true, mustChangePassword: true },
      session: {
        token: "opaque-token",
        expiresAt: "2026-08-12T12:00:00.000Z",
      },
    });
    const { POST } = await import("../app/api/auth/sign-in/route");
    const response = await POST(request("/api/auth/sign-in", {
      email: "maya@example.com",
      password: "temporary password",
    }, { "cf-connecting-ip": "203.0.113.1", "user-agent": "test-agent" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("daymark_session=opaque-token");
    expect(auth.signIn).toHaveBeenCalledWith(
      { email: "maya@example.com", password: "temporary password" },
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("requires matching replacement passwords before changing the password", async () => {
    const { POST } = await import("../app/api/auth/password/route");
    const response = await POST(request("/api/auth/password", {
      password: "a replacement password",
      confirmation: "a different password",
    }, { cookie: "daymark_session=opaque-token" }));

    expect(response.status).toBe(400);
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it("replaces the session cookie after a successful password change", async () => {
    auth.changePassword.mockResolvedValue({
      status: 200,
      body: { ok: true, mustChangePassword: false },
      session: {
        token: "replacement-token",
        expiresAt: "2026-08-12T12:00:00.000Z",
      },
    });
    const { POST } = await import("../app/api/auth/password/route");
    const response = await POST(request("/api/auth/password", {
      password: "a replacement password",
      confirmation: "a replacement password",
    }, { cookie: "daymark_session=opaque-token" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("daymark_session=replacement-token");
  });

  it("always clears the browser cookie and revokes a present session", async () => {
    auth.signOut.mockResolvedValue({ status: 200, body: { ok: true } });
    const { POST } = await import("../app/api/auth/sign-out/route");
    const withoutToken = await POST(request("/api/auth/sign-out", {}));
    const withToken = await POST(request("/api/auth/sign-out", {}, {
      cookie: "daymark_session=opaque-token",
    }));

    expect(withoutToken.status).toBe(200);
    expect(withoutToken.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(withToken.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith("opaque-token");
  });

  it("clears the browser cookie when session revocation fails", async () => {
    auth.signOut.mockRejectedValue(new Error("private D1 failure details"));
    const { POST } = await import("../app/api/auth/sign-out/route");
    const response = await POST(request("/api/auth/sign-out", {}, {
      cookie: "daymark_session=opaque-token",
    }));

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toContain("daymark_session=");
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await response.json()).toEqual({
      ok: false,
      error: "Sign out could not be completed.",
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.signOut).toHaveBeenCalledWith("opaque-token");
  });

  it("clears the browser cookie while rejecting cross-origin sign-out", async () => {
    const { POST } = await import("../app/api/auth/sign-out/route");
    const response = await POST(new Request(`${origin}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        cookie: "daymark_session=opaque-token",
      },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
