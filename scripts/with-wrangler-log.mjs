import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ALLOWED_COMMANDS = new Set(["dev", "build", "start"]);

export function createVinextInvocation(command, options = {}) {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error("Expected one of: dev, build, start");
  }

  const projectRoot = options.projectRoot ?? path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const pathApi = /^[A-Za-z]:[\\/]/.test(projectRoot) ? path.win32 : path.posix;

  return {
    file: options.execPath ?? process.execPath,
    args: [pathApi.join(projectRoot, "node_modules", "vinext", "dist", "cli.js"), command],
    cwd: projectRoot,
    env: {
      ...(options.env ?? process.env),
      WRANGLER_LOG_PATH: (options.env ?? process.env).WRANGLER_LOG_PATH || ".wrangler/wrangler.log",
    },
    shell: false,
  };
}

async function main() {
  const invocation = createVinextInvocation(process.argv[2]);
  const child = spawn(invocation.file, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
    shell: invocation.shell,
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(`Unable to start Vinext: ${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    if (signal) {
      console.error(`Vinext stopped after receiving ${signal}.`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
