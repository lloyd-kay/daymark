import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { RuntimeConfig } from "./contracts";
import { redactText } from "./process";
import { serveCommand } from "./wrangler";

export interface RuntimeHealth {
  status: "ok";
  appVersion: string;
  latestMigration: string;
}

export interface HealthWaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export interface RuntimeHandle {
  child: ChildProcessWithoutNullStreams;
  health: RuntimeHealth;
  exited: Promise<number | null>;
  stop(): Promise<void>;
}

export async function waitForHealth(
  url: string,
  options: HealthWaitOptions = {},
): Promise<RuntimeHealth> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(Math.min(2_000, Math.max(1, deadline - Date.now()))),
      });
      const body = await response.json() as Partial<RuntimeHealth>;
      if (
        response.ok
        && body.status === "ok"
        && typeof body.appVersion === "string"
        && typeof body.latestMigration === "string"
      ) {
        return body as RuntimeHealth;
      }
    } catch {
      // Connection failures are expected while the local runtime starts.
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }

  throw new Error(`Daymark did not become healthy within ${timeoutMs}ms`);
}

export async function startRuntime(config: RuntimeConfig): Promise<RuntimeHandle> {
  const command = serveCommand(config);
  const child = spawn(command.file, command.args, {
    cwd: command.cwd,
    env: command.env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  const secrets = command.secretValues ?? [];
  const capture = (chunk: Buffer) => {
    diagnostics = `${diagnostics}${chunk.toString("utf8")}`.slice(-64 * 1024);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", (error) => reject(new Error(`Unable to start Daymark: ${redactText(error.message, secrets)}`)));
    child.once("exit", (code) => resolve(code));
  });

  let health: RuntimeHealth;
  try {
    health = await Promise.race([
      waitForHealth(`http://${config.host}:${config.port}/api/health`),
      exited.then((code) => {
        throw new Error(`Daymark exited before becoming healthy (${code ?? "unknown"}): ${redactText(diagnostics, secrets)}`);
      }),
    ]);
  } catch (error) {
    if (child.exitCode === null) child.kill("SIGTERM");
    throw error;
  }

  return {
    child,
    health,
    exited,
    stop: () => stopChild(child, exited),
  };
}

async function stopChild(child: ChildProcessWithoutNullStreams, exited: Promise<number | null>): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    exited,
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 10_000);
    }),
  ]);
  if (timer) clearTimeout(timer);
}
