import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseArgs, resolveConfig } from "../../runtime/local/cli";

describe("local runtime CLI", () => {
  it("parses a start command and validated port", () => {
    expect(parseArgs(["start", "--port", "3210"])).toEqual({ command: "start", port: 3210 });
  });

  it("rejects privileged, malformed, and unknown ports", () => {
    expect(() => parseArgs(["start", "--port", "80"])).toThrow("Port must be between 1024 and 65535");
    expect(() => parseArgs(["start", "--port", "nope"])).toThrow("Port must be between 1024 and 65535");
    expect(() => parseArgs(["start", "--unknown", "value"])).toThrow("Unknown option: --unknown");
  });

  it("requires the setup code through the environment rather than command arguments", () => {
    const parsed = parseArgs([
      "migrate",
      "--app-dir", "C:\\Daymark",
      "--data-dir", "C:\\DaymarkData",
      "--backup-dir", "C:\\DaymarkBackups",
      "--log-dir", "C:\\DaymarkLogs",
    ]);
    const config = resolveConfig(parsed, { DAYMARK_SETUP_CODE: "ENV-ONLY-SECRET" });

    expect(config.setupCode).toBe("ENV-ONLY-SECRET");
    expect(config.paths).toEqual({
      appDir: "C:\\Daymark",
      dataDir: "C:\\DaymarkData",
      backupDir: "C:\\DaymarkBackups",
      logDir: "C:\\DaymarkLogs",
    });
    expect(JSON.stringify(parsed)).not.toContain("ENV-ONLY-SECRET");
  });

  it("requires a manifest for backup verification and restore", () => {
    expect(() => parseArgs(["verify-backup"])).toThrow("--manifest is required for verify-backup");
    expect(() => parseArgs(["restore"])).toThrow("--manifest is required for restore");
    expect(parseArgs(["verify-backup", "--manifest", path.join("backups", "daymark.json")])).toEqual({
      command: "verify-backup",
      manifest: path.join("backups", "daymark.json"),
    });
  });
});
