import { describe, expect, it, vi } from "vitest";
import { performEnrolment } from "../lib/auth/enrolment";
import type { AuthenticatedIdentity } from "../lib/data/contracts";

const identity: AuthenticatedIdentity = {
  userId: "oai-user-1",
  email: "admin@example.com",
  displayName: "Admin User",
};

describe("workspace enrolment", () => {
  it("rejects anonymous requests before checking a code", async () => {
    const claimAdministrator = vi.fn();
    const redeemInvitation = vi.fn();

    const result = await performEnrolment(
      null,
      { kind: "setup", code: "secret" },
      { claimAdministrator, redeemInvitation },
    );

    expect(result.status).toBe(401);
    expect(claimAdministrator).not.toHaveBeenCalled();
    expect(redeemInvitation).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies with a neutral response", async () => {
    const result = await performEnrolment(identity, { kind: "setup" }, {
      claimAdministrator: vi.fn(),
      redeemInvitation: vi.fn(),
    });

    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: "Enter a valid access code." },
    });
  });

  it("claims the first administrator with a setup code", async () => {
    const claimAdministrator = vi.fn().mockResolvedValue({ role: "admin" });

    const result = await performEnrolment(
      identity,
      { kind: "setup", code: "secret" },
      { claimAdministrator, redeemInvitation: vi.fn() },
    );

    expect(claimAdministrator).toHaveBeenCalledWith(identity, "secret");
    expect(result.status).toBe(200);
  });

  it("redeems an employee invitation exactly once", async () => {
    const redeemInvitation = vi.fn().mockResolvedValue({ role: "employee" });

    const result = await performEnrolment(
      identity,
      { kind: "invitation", code: "DAYMARK-ABC" },
      { claimAdministrator: vi.fn(), redeemInvitation },
    );

    expect(redeemInvitation).toHaveBeenCalledWith(identity, "DAYMARK-ABC");
    expect(result.status).toBe(200);
  });
});
