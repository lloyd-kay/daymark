import { describe, expect, it } from "vitest";
import {
  PUBLIC_PROFILE_SEEDS,
  invitationIsUsable,
  profileIdsForScope,
  retentionCutoffIso,
  sha256,
  toPublicEmployee,
} from "../lib/data/repository";
import {
  loginLockUntil,
  nextIdleExpiry,
  sessionIsUsable,
} from "../lib/auth/repository";

describe("public employee projection", () => {
  it("keeps only fields that are safe for anonymous clients", () => {
    const publicEmployee = toPublicEmployee({
      id: "maya",
      membershipId: "private-membership",
      publicName: "Maya Chen",
      title: "Client partner",
      bio: "Thoughtful planning.",
      accent: "coral",
      active: true,
      sortOrder: 0,
    });

    expect(publicEmployee).toEqual({
      id: "maya",
      publicName: "Maya Chen",
      title: "Client partner",
      bio: "Thoughtful planning.",
      accent: "coral",
    });
    expect(publicEmployee).not.toHaveProperty("membershipId");
    expect(publicEmployee).not.toHaveProperty("active");
  });
});

describe("schedule privacy scope", () => {
  it("limits an employee to their own profile", () => {
    expect(
      profileIdsForScope(
        { role: "employee", employeeProfileId: "maya" },
        ["maya", "theo"],
      ),
    ).toEqual(["maya"]);
  });

  it("allows an administrator to view the requested team profiles", () => {
    expect(
      profileIdsForScope(
        { role: "admin", employeeProfileId: null },
        ["maya", "theo"],
      ),
    ).toEqual(["maya", "theo"]);
  });
});

describe("privacy retention", () => {
  it("calculates a cutoff exactly 30 days before the current instant", () => {
    expect(retentionCutoffIso(new Date("2026-08-05T12:00:00.000Z"))).toBe(
      "2026-07-06T12:00:00.000Z",
    );
  });
});

describe("single-use invitations", () => {
  it("rejects redeemed and expired invitations", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");

    expect(
      invitationIsUsable(
        { expiresAt: "2026-08-06T12:00:00.000Z", redeemedAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      invitationIsUsable(
        {
          expiresAt: "2026-08-06T12:00:00.000Z",
          redeemedAt: "2026-08-05T11:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      invitationIsUsable(
        { expiresAt: "2026-08-05T11:59:59.000Z", redeemedAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("hashes access codes deterministically without retaining the raw code", async () => {
    const first = await sha256("DAYMARK-ALPHA");
    const second = await sha256("DAYMARK-ALPHA");

    expect(first).toBe(second);
    expect(first).not.toContain("DAYMARK-ALPHA");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("initial roster", () => {
  it("provides four concrete editable employee profiles", () => {
    expect(PUBLIC_PROFILE_SEEDS.map((profile) => profile.publicName)).toEqual([
      "Maya Chen",
      "Theo Brooks",
      "Priya Shah",
      "Jon Bell",
    ]);
  });
});

describe("authentication persistence projections", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("caps the rolling 12-hour idle expiry at the absolute expiry", () => {
    expect(nextIdleExpiry(now, "2026-08-06T06:00:00.000Z")).toBe(
      "2026-08-06T00:00:00.000Z",
    );
    expect(nextIdleExpiry(now, "2026-08-05T20:00:00.000Z")).toBe(
      "2026-08-05T20:00:00.000Z",
    );
  });

  it("locks on the fifth failure for exactly 15 minutes", () => {
    expect(loginLockUntil(4, now)).toBeNull();
    expect(loginLockUntil(5, now)).toBe("2026-08-05T12:15:00.000Z");
  });

  it("rejects revoked, idle-expired, and absolute-expired sessions", () => {
    const usable = {
      revokedAt: null,
      idleExpiresAt: "2026-08-05T13:00:00.000Z",
      absoluteExpiresAt: "2026-08-12T12:00:00.000Z",
    };
    expect(sessionIsUsable(usable, now)).toBe(true);
    expect(sessionIsUsable({ ...usable, revokedAt: now.toISOString() }, now)).toBe(false);
    expect(sessionIsUsable({ ...usable, idleExpiresAt: now.toISOString() }, now)).toBe(false);
    expect(sessionIsUsable({ ...usable, absoluteExpiresAt: now.toISOString() }, now)).toBe(false);
  });
});
