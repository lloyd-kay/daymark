import { describe, expect, it } from "vitest";

import { resolveRuntimePaths } from "../../runtime/local/paths";

describe("resolveRuntimePaths", () => {
  it("keeps Windows mutable data outside the application directory", () => {
    const paths = resolveRuntimePaths({
      platform: "win32",
      programFiles: "C:\\Program Files",
      programData: "C:\\ProgramData",
    });

    expect(paths).toEqual({
      appDir: "C:\\Program Files\\Daymark",
      dataDir: "C:\\ProgramData\\Daymark\\data",
      backupDir: "C:\\ProgramData\\Daymark\\backups",
      logDir: "C:\\ProgramData\\Daymark\\logs",
    });
  });

  it("uses configurable Linux roots for containers", () => {
    const paths = resolveRuntimePaths({
      platform: "linux",
      appRoot: "/opt",
      stateRoot: "/var/lib",
      logRoot: "/var/log",
    });

    expect(paths).toEqual({
      appDir: "/opt/daymark",
      dataDir: "/var/lib/daymark/data",
      backupDir: "/var/lib/daymark/backups",
      logDir: "/var/log/daymark",
    });
  });
});
