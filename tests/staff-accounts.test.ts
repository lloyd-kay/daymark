import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  insertStaffCredential: vi.fn(),
  replaceStaffPasswordVerifier: vi.fn(),
  setStaffActiveState: vi.fn(),
  revokeMembershipSessions: vi.fn(),
}));

const password = vi.hoisted(() => ({
  generateTemporaryPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../lib/auth/repository", () => repository);
vi.mock("../lib/auth/password", () => password);

import {
  createStaffAccount,
  resetStaffPassword,
  setStaffActive,
} from "../lib/auth/staff-accounts";

const verifier = {
  hash: "derived-password-hash",
  salt: "random-salt",
  iterations: 210_000,
};

beforeEach(() => {
  vi.resetAllMocks();
  password.generateTemporaryPassword.mockReturnValue("ABCDE-FGHJK-LMNPQ-RSTUV");
  password.hashPassword.mockResolvedValue(verifier);
  repository.insertStaffCredential.mockResolvedValue({ membershipId: "membership-theo" });
  repository.replaceStaffPasswordVerifier.mockResolvedValue(true);
  repository.setStaffActiveState.mockResolvedValue({ membershipId: "membership-theo" });
  repository.revokeMembershipSessions.mockResolvedValue(undefined);
});

describe("staff credential lifecycle", () => {
  it("persists only a verifier and returns plaintext from the successful create call", async () => {
    const result = await createStaffAccount("membership-admin", {
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      displayName: "Theo Brooks",
    });

    expect(result).toEqual({ temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV" });
    expect(repository.insertStaffCredential).toHaveBeenCalledWith(
      "membership-admin",
      {
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        displayName: "Theo Brooks",
        verifier,
      },
    );
    expect(JSON.stringify(repository.insertStaffCredential.mock.calls)).not.toContain(
      "ABCDE-FGHJK-LMNPQ-RSTUV",
    );
  });

  it("does not return a temporary password when credential creation fails", async () => {
    repository.insertStaffCredential.mockResolvedValue(null);

    await expect(createStaffAccount("membership-admin", {
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      displayName: "Theo Brooks",
    })).resolves.toBeNull();
  });

  it("returns plaintext only when an authorized verifier replacement succeeds", async () => {
    const result = await resetStaffPassword("membership-admin", "theo-brooks");

    expect(result).toEqual({ temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV" });
    expect(repository.replaceStaffPasswordVerifier).toHaveBeenCalledWith(
      "membership-admin",
      "theo-brooks",
      verifier,
    );
    expect(JSON.stringify(repository.replaceStaffPasswordVerifier.mock.calls)).not.toContain(
      "ABCDE-FGHJK-LMNPQ-RSTUV",
    );

    repository.replaceStaffPasswordVerifier.mockResolvedValue(false);
    await expect(
      resetStaffPassword("membership-admin", "theo-brooks"),
    ).resolves.toBeNull();
  });

  it("updates both active states and revokes target sessions on deactivation", async () => {
    await expect(
      setStaffActive("membership-admin", "theo-brooks", false),
    ).resolves.toBe(true);

    expect(repository.setStaffActiveState).toHaveBeenCalledWith(
      "membership-admin",
      "theo-brooks",
      false,
    );
    expect(repository.revokeMembershipSessions).toHaveBeenCalledWith(
      "membership-theo",
    );
  });

  it("does not revoke sessions for activation or rejected changes", async () => {
    await expect(
      setStaffActive("membership-admin", "theo-brooks", true),
    ).resolves.toBe(true);
    expect(repository.revokeMembershipSessions).not.toHaveBeenCalled();

    repository.setStaffActiveState.mockResolvedValue(null);
    await expect(
      setStaffActive("membership-admin", "theo-brooks", false),
    ).resolves.toBe(false);
    expect(repository.revokeMembershipSessions).not.toHaveBeenCalled();
  });
});
