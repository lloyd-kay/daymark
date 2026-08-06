import path from "node:path";

import type { RuntimePaths } from "./contracts";

interface WindowsPathOptions {
  platform: "win32";
  programFiles?: string;
  programData?: string;
}

interface PosixPathOptions {
  platform: "linux" | "darwin";
  appRoot?: string;
  stateRoot?: string;
  logRoot?: string;
}

export type RuntimePathOptions = WindowsPathOptions | PosixPathOptions;

export function resolveRuntimePaths(options: RuntimePathOptions): RuntimePaths {
  if (options.platform === "win32") {
    const programFiles = options.programFiles ?? process.env.ProgramFiles ?? "C:\\Program Files";
    const programData = options.programData ?? process.env.ProgramData ?? "C:\\ProgramData";
    const stateRoot = path.win32.join(programData, "Daymark");

    return {
      appDir: path.win32.join(programFiles, "Daymark"),
      dataDir: path.win32.join(stateRoot, "data"),
      backupDir: path.win32.join(stateRoot, "backups"),
      logDir: path.win32.join(stateRoot, "logs"),
    };
  }

  const appRoot = options.appRoot ?? "/opt";
  const stateRoot = options.stateRoot ?? "/var/lib";
  const logRoot = options.logRoot ?? "/var/log";

  return {
    appDir: path.posix.join(appRoot, "daymark"),
    dataDir: path.posix.join(stateRoot, "daymark", "data"),
    backupDir: path.posix.join(stateRoot, "daymark", "backups"),
    logDir: path.posix.join(logRoot, "daymark"),
  };
}
