import { describe, expect, it } from "vitest";
import {
  PUBLIC_PROFILE_SEEDS,
  invitationIsUsable,
  profileIdsForScope,
  retentionCutoffIso,
  sha256,
  toPublicEmployee,
} from "../lib/data/repository";

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
