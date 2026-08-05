import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  insertStaffCredential: vi.fn(),
  replaceStaffPasswordVerifier: vi.fn(),
  setStaffActiveState: vi.fn(),
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
});

describe("staff credential lifecycle", () => {
  it("persists only a verifier and returns plaintext from the successful create call", async () => {
    const result = await createStaffAccount("membership-admin", {
      employeeProfileId: "theo-brooks",
      email: "theo@example.com",
      displayName: "Theo Brooks",
      confirm: true,
    });

    expect(result).toEqual({
      membershipId: "membership-theo",
      temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV",
    });
    expect(repository.insertStaffCredential).toHaveBeenCalledWith(
      "membership-admin",
      {
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        displayName: "Theo Brooks",
        verifier,
        confirm: true,
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
      confirm: true,
    })).resolves.toBeNull();
  });

  it("returns plaintext only when an authorized verifier replacement succeeds", async () => {
    const result = await resetStaffPassword("membership-admin", "theo-brooks", true);

    expect(result).toEqual({ temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV" });
    expect(repository.replaceStaffPasswordVerifier).toHaveBeenCalledWith(
      "membership-admin",
      "theo-brooks",
      verifier,
      true,
    );
    expect(JSON.stringify(repository.replaceStaffPasswordVerifier.mock.calls)).not.toContain(
      "ABCDE-FGHJK-LMNPQ-RSTUV",
    );

    repository.replaceStaffPasswordVerifier.mockResolvedValue(false);
    await expect(
      resetStaffPassword("membership-admin", "theo-brooks", true),
    ).resolves.toBeNull();
  });

  it("delegates deactivation to the repository's atomic state-and-session batch", async () => {
    await expect(
      setStaffActive("membership-admin", "theo-brooks", false, true),
    ).resolves.toBe(true);

    expect(repository.setStaffActiveState).toHaveBeenCalledWith(
      "membership-admin",
      "theo-brooks",
      false,
      true,
    );
  });

  it("returns false when an atomic active-state change is rejected", async () => {
    await expect(
      setStaffActive("membership-admin", "theo-brooks", true, true),
    ).resolves.toBe(true);

    repository.setStaffActiveState.mockResolvedValue(null);
    await expect(
      setStaffActive("membership-admin", "theo-brooks", false, true),
    ).resolves.toBe(false);
  });
});
