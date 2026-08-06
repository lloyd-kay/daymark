export interface RuntimePaths {
  appDir: string;
  dataDir: string;
  backupDir: string;
  logDir: string;
}

export interface RuntimeConfig {
  host: "127.0.0.1" | "0.0.0.0";
  port: number;
  paths: RuntimePaths;
  setupCode: string;
}

export interface CommandSpec {
  file: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  secretValues?: string[];
  maxCaptureBytes?: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
