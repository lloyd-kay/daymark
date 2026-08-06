import { describe, expect, it } from "vitest";

import { parseBackupSummary, parseSetupState, parseSetupCode } from "./control";

describe("Daymark Control command results", () => {
  it("accepts only a complete setup state and protected-code format", () => {
    expect(parseSetupState({ configured: true })).toEqual({ configured: true });
    expect(parseSetupCode("AAAAA-AAAAA-AAAAA-AAAAA")).toBe("AAAAA-AAAAA-AAAAA-AAAAA");
    expect(() => parseSetupState({ configured: "yes" })).toThrow("invalid setup state");
    expect(() => parseSetupCode("not-a-setup-code")).toThrow("invalid setup code");
  });

  it("accepts only verified backup summaries", () => {
    expect(
      parseBackupSummary({
        manifestFile: "C:\\ProgramData\\Daymark\\backups\\daymark.json",
        createdAt: "2026-08-06T12:00:00.000Z",
        integrity: "verified",
      }).integrity,
    ).toBe("verified");
    expect(() =>
      parseBackupSummary({
        manifestFile: "C:\\ProgramData\\Daymark\\backups\\daymark.json",
        createdAt: "2026-08-06T12:00:00.000Z",
        integrity: "unknown",
      }),
    ).toThrow("invalid backup result");
  });
});
