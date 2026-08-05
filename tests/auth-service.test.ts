import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../lib/auth/service";

const now = new Date("2026-08-05T12:00:00.000Z");
const token = "A".repeat(43);
const tokenHash = "a".repeat(64);

function dependencies(
  options: {
    credential?: null | Record<string, unknown>;
    verifyPassword?: boolean;
    mustChangePassword?: boolean;
    administratorExists?: boolean;
    retryAt?: string | null;
    failedRetryAt?: string | null;
    actor?: null | Record<string, unknown>;
  } = {},
) {
  const credential = options.credential === null
    ? null
    : {
        membershipId: "membership-maya",
        employeeProfileId: "maya-chen",
        displayName: "Maya Chen",
        role: "employee" as const,
        active: true,
        email: "maya@example.com",
        passwordHash: "stored-hash",
        passwordSalt: "stored-salt",
        passwordIterations: 210_000,
        mustChangePassword: options.mustChangePassword ?? false,
        lockedUntil: null,
        ...options.credential,
      };
  const actor = options.actor === null
    ? null
    : {
        membershipId: "membership-maya",
        employeeProfileId: "maya-chen",
        displayName: "Maya Chen",
        email: "maya@example.com",
        role: "employee" as const,
        active: true,
        mustChangePassword: true,
        idleExpiresAt: "2026-08-06T00:00:00.000Z",
        absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
        ...options.actor,
      };

  return {
    administratorExists: vi.fn().mockResolvedValue(options.administratorExists ?? false),
    createAdministratorAccount: vi.fn().mockResolvedValue({ membershipId: "membership-admin" }),
    findCredentialByEmail: vi.fn().mockResolvedValue({
      credential,
      retryAt: options.retryAt ?? null,
    }),
    recordFailedLogin: vi.fn().mockResolvedValue(options.failedRetryAt ?? null),
    clearFailedLogins: vi.fn().mockResolvedValue(undefined),
    createAuthSession: vi.fn().mockResolvedValue(undefined),
    findSessionActor: vi.fn().mockResolvedValue(actor),
    replacePassword: vi.fn().mockResolvedValue(undefined),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeMembershipSessions: vi.fn().mockResolvedValue(undefined),
    hashOpaqueValue: vi.fn().mockImplementation(async (value: string) => {
      if (value === token) return tokenHash;
      if (value === "wrong") return "c".repeat(64);
      if (value === "expected") return "d".repeat(64);
      return "b".repeat(64);
    }),
    hashPassword: vi.fn().mockResolvedValue({
      hash: "new-hash",
      salt: "new-salt",
      iterations: 210_000,
    }),
    verifyPassword: vi.fn().mockResolvedValue(options.verifyPassword ?? true),
    generateSessionToken: vi.fn().mockReturnValue(token),
  };
}

describe("authentication service", () => {
  it("returns the same invalid response for a missing account and a wrong password", async () => {
    const missing = dependencies({ credential: null });
    const wrong = dependencies({ verifyPassword: false });
    const first = await createAuthService(missing).signIn(
      { email: "nobody@example.com", password: "incorrect password" },
      "fingerprint",
      now,
    );
    const second = await createAuthService(wrong).signIn(
      { email: "maya@example.com", password: "incorrect password" },
      "fingerprint",
      now,
    );
    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 401,
      body: { ok: false, error: "Email or password not recognised." },
    });
    expect(missing.verifyPassword).toHaveBeenCalledWith(
      "incorrect password",
      {
        salt: "AAAAAAAAAAAAAAAAAAAAAA",
        hash: "A0Bw09WO7-dVT6w2l1AasdIZCVZwAvyGoFtu5dQAg7U",
        iterations: 210_000,
      },
    );
    expect(missing.recordFailedLogin).toHaveBeenCalledWith(
      "b".repeat(64),
      "fingerprint",
      null,
      now,
    );
  });

  it("creates a session while preserving the forced-password-change gate", async () => {
    const deps = dependencies({ verifyPassword: true, mustChangePassword: true });
    const result = await createAuthService(deps).signIn(
      { email: "maya@example.com", password: "temporary password" },
      "fingerprint",
      now,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, mustChangePassword: true });
    expect(result.session?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deps.createAuthSession).toHaveBeenCalledWith(
      "membership-maya",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.objectContaining({
        idleExpiresAt: "2026-08-06T00:00:00.000Z",
        absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
      }),
    );
  });

  it("rejects a setup-code mismatch without looking for an administrator", async () => {
    const deps = dependencies();
    const result = await createAuthService(deps).setup(
      {
        setupCode: "wrong",
        displayName: "Maya Chen",
        email: "maya@example.com",
        password: "a secure password",
      },
      "expected",
      now,
    );
    expect(result).toEqual({
      status: 403,
      body: { ok: false, error: "Setup code not recognised." },
    });
    expect(deps.administratorExists).not.toHaveBeenCalled();
  });

  it("denies setup after the administrator has been created", async () => {
    const deps = dependencies({ administratorExists: true });
    deps.hashOpaqueValue.mockResolvedValueOnce("same").mockResolvedValueOnce("same");
    const result = await createAuthService(deps).setup(
      {
        setupCode: "expected",
        displayName: "Maya Chen",
        email: "maya@example.com",
        password: "a secure password",
      },
      "expected",
      now,
    );
    expect(result).toEqual({
      status: 409,
      body: { ok: false, error: "Administrator setup has already been completed." },
    });
  });

  it("creates the first administrator with a normalized email and a session", async () => {
    const deps = dependencies();
    deps.hashOpaqueValue.mockResolvedValueOnce("same").mockResolvedValueOnce("same");
    const result = await createAuthService(deps).setup(
      {
        setupCode: "expected",
        displayName: "  Maya Chen  ",
        email: "  MAYA@EXAMPLE.COM ",
        password: "a secure password",
      },
      "expected",
      now,
    );
    expect(deps.createAdministratorAccount).toHaveBeenCalledWith({
      email: "maya@example.com",
      displayName: "Maya Chen",
      verifier: {
        hash: "new-hash",
        salt: "new-salt",
        iterations: 210_000,
      },
      mustChangePassword: false,
    });
    expect(result).toEqual({
      status: 200,
      body: { ok: true, mustChangePassword: false },
      session: { token, expiresAt: "2026-08-12T12:00:00.000Z" },
    });
  });

  it("rejects permanent passwords outside the 12 to 128 character range", async () => {
    const deps = dependencies();
    deps.hashOpaqueValue.mockResolvedValueOnce("same").mockResolvedValueOnce("same");
    const result = await createAuthService(deps).setup(
      {
        setupCode: "expected",
        displayName: "Maya Chen",
        email: "maya@example.com",
        password: "too short",
      },
      "expected",
      now,
    );
    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: "Password must be between 12 and 128 characters." },
    });
  });

  it("returns a retry response when the fifth failure locks the subject", async () => {
    const deps = dependencies({
      verifyPassword: false,
      failedRetryAt: "2026-08-05T12:15:00.000Z",
    });
    const result = await createAuthService(deps).signIn(
      { email: "maya@example.com", password: "incorrect password" },
      "fingerprint",
      now,
    );
    expect(result).toEqual({
      status: 429,
      body: { ok: false, error: "Too many attempts. Try again in 15 minutes." },
    });
  });

  it("clears subject and credential failures after successful verification", async () => {
    const deps = dependencies({ verifyPassword: true });
    await createAuthService(deps).signIn(
      { email: "  MAYA@EXAMPLE.COM ", password: "correct password" },
      "fingerprint",
      now,
    );
    expect(deps.findCredentialByEmail).toHaveBeenCalledWith(
      "maya@example.com",
      "b".repeat(64),
      "fingerprint",
      now,
    );
    expect(deps.clearFailedLogins).toHaveBeenCalledWith(
      "b".repeat(64),
      "fingerprint",
      "membership-maya",
    );
  });

  it("changes the password by replacing all previous sessions with one new session", async () => {
    const deps = dependencies();
    const result = await createAuthService(deps).changePassword(
      token,
      "a replacement password",
      now,
    );
    expect(result.body).toEqual({ ok: true, mustChangePassword: false });
    expect(deps.replacePassword).toHaveBeenCalledWith("membership-maya", {
      hash: "new-hash",
      salt: "new-salt",
      iterations: 210_000,
    });
    expect(deps.revokeMembershipSessions).toHaveBeenCalledWith("membership-maya", now);
    expect(deps.createAuthSession).toHaveBeenCalledWith(
      "membership-maya",
      tokenHash,
      expect.objectContaining({
        idleExpiresAt: "2026-08-06T00:00:00.000Z",
        absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
      }),
    );
  });

  it("rejects a password change when the active session is missing", async () => {
    const deps = dependencies({ actor: null });
    const result = await createAuthService(deps).changePassword(
      token,
      "a replacement password",
      now,
    );
    expect(result).toEqual({
      status: 401,
      body: { ok: false, error: "Sign in is required." },
    });
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("rejects a short replacement password before deriving a verifier", async () => {
    const deps = dependencies();
    const result = await createAuthService(deps).changePassword(token, "too short", now);
    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: "Password must be between 12 and 128 characters." },
    });
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("revokes the current token hash on logout", async () => {
    const deps = dependencies();
    const result = await createAuthService(deps).signOut(token, now);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(deps.revokeSession).toHaveBeenCalledWith(tokenHash, now);
  });
});
