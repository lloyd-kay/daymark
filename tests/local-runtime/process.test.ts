import { describe, expect, it } from "vitest";

import { CommandExecutionError, redactText, runCommand } from "../../runtime/local/process";

describe("redactText", () => {
  it("replaces every occurrence of each non-empty secret", () => {
    expect(redactText("token-123 then token-123 and setup-456", ["token-123", "", "setup-456"]))
      .toBe("[REDACTED] then [REDACTED] and [REDACTED]");
  });
});

describe("runCommand", () => {
  it("captures output without exposing configured secrets", async () => {
    const result = await runCommand({
      file: process.execPath,
      args: ["-e", "console.log('safe token-123')"],
      cwd: process.cwd(),
      secretValues: ["token-123"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("safe [REDACTED]");
    expect(result.stdout).not.toContain("token-123");
  });

  it("rejects a failed command with redacted bounded diagnostics", async () => {
    const promise = runCommand({
      file: process.execPath,
      args: ["-e", "console.error('bad token-123'); process.exit(7)"],
      cwd: process.cwd(),
      secretValues: ["token-123"],
      maxCaptureBytes: 128,
    });

    await expect(promise).rejects.toMatchObject({
      name: "CommandExecutionError",
      result: { exitCode: 7, stderr: expect.stringContaining("bad [REDACTED]") },
    });

    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(CommandExecutionError);
      expect(String(error)).not.toContain("token-123");
    }
  });
});
