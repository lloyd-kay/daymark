import { spawn } from "node:child_process";

import type { CommandResult, CommandSpec } from "./contracts";

const DEFAULT_MAX_CAPTURE_BYTES = 64 * 1024;

export class CommandExecutionError extends Error {
  readonly result: CommandResult;

  constructor(message: string, result: CommandResult) {
    super(message);
    this.name = "CommandExecutionError";
    this.result = result;
  }
}

export function redactText(value: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((text, secret) => text.split(secret).join("[REDACTED]"), value);
}

function appendBounded(current: Buffer, chunk: Buffer, maximum: number): Buffer {
  const combined = Buffer.concat([current, chunk]);
  return combined.byteLength <= maximum ? combined : combined.subarray(combined.byteLength - maximum);
}

export function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const maximum = spec.maxCaptureBytes ?? DEFAULT_MAX_CAPTURE_BYTES;
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    return Promise.reject(new TypeError("maxCaptureBytes must be a positive integer"));
  }

  return new Promise((resolve, reject) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const child = spawn(spec.file, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk, maximum);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk, maximum);
    });

    child.once("error", (error) => {
      const secrets = spec.secretValues ?? [];
      const result = { exitCode: -1, stdout: "", stderr: redactText(error.message, secrets) };
      reject(new CommandExecutionError(`Unable to start command: ${result.stderr}`, result));
    });

    child.once("close", (code) => {
      const secrets = spec.secretValues ?? [];
      const result: CommandResult = {
        exitCode: code ?? -1,
        stdout: redactText(stdout.toString("utf8"), secrets),
        stderr: redactText(stderr.toString("utf8"), secrets),
      };

      if (result.exitCode !== 0) {
        reject(new CommandExecutionError(`Command failed with exit code ${result.exitCode}: ${result.stderr}`, result));
        return;
      }
      resolve(result);
    });
  });
}
